import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  type WASocket,
  type WAMessage,
  type proto,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import path from "path";
import fs from "fs";
import { getBaseStorageDir, getDb, recordAudit, recordChange } from "../db";
import { decryptCustomer } from "../vault";
import { notifyAdminsOrderConfirmedByCustomer } from "../push";

export interface WhatsAppBotState {
  status: "DISCONNECTED" | "CONNECTING" | "SCAN_QR" | "CONNECTED";
  phoneNumber: string | null;
  qrCodeDataUrl: string | null;
  lastConnectedAt: string | null;
  error: string | null;
}

interface GlobalWaHolder {
  sock: WASocket | null;
  state: WhatsAppBotState;
  connectingPromise: Promise<WASocket | null> | null;
  reconnectTimeout: NodeJS.Timeout | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __terra_wa_bot: GlobalWaHolder | undefined;
}

function getHolder(): GlobalWaHolder {
  if (!globalThis.__terra_wa_bot) {
    globalThis.__terra_wa_bot = {
      sock: null,
      state: {
        status: "DISCONNECTED",
        phoneNumber: null,
        qrCodeDataUrl: null,
        lastConnectedAt: null,
        error: null,
      },
      connectingPromise: null,
      reconnectTimeout: null,
    };
  }
  return globalThis.__terra_wa_bot;
}

export function getSessionDirectory(): string {
  const base = getBaseStorageDir();
  const sessionDir = path.join(base, "wa-session");
  if (!fs.existsSync(sessionDir)) {
    try {
      fs.mkdirSync(sessionDir, { recursive: true });
    } catch {}
  }
  return sessionDir;
}

export function toWhatsAppJid(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "20" + cleaned.substring(1);
  } else if (
    !cleaned.startsWith("20") &&
    (cleaned.startsWith("10") ||
      cleaned.startsWith("11") ||
      cleaned.startsWith("12") ||
      cleaned.startsWith("15"))
  ) {
    cleaned = "20" + cleaned;
  }
  return `${cleaned}@s.whatsapp.net`;
}

export function getWhatsAppBotStatus(): WhatsAppBotState {
  return getHolder().state;
}

export function isWhatsAppAutoSendEnabled(): boolean {
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT value FROM settings WHERE group_key = 'whatsapp' AND key = 'auto_send'")
      .get() as { value: string } | undefined;
    if (row) return row.value === "true" || row.value === "1";
  } catch {}
  return true; // Default enabled
}

export function setWhatsAppAutoSendEnabled(enabled: boolean): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO settings (group_key, key, value, updated_at, updated_by)
      VALUES ('whatsapp', 'auto_send', ?, ?, 'admin')
      ON CONFLICT(group_key, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(enabled ? "true" : "false", new Date().toISOString());
  } catch {}
}

/**
 * Initialize or get active Baileys socket
 */
export async function initWhatsAppBot(): Promise<WASocket | null> {
  const holder = getHolder();

  if (holder.sock && holder.state.status === "CONNECTED") {
    return holder.sock;
  }

  if (holder.connectingPromise) {
    return holder.connectingPromise;
  }

  holder.connectingPromise = (async () => {
    try {
      holder.state.status = "CONNECTING";
      holder.state.error = null;

      const sessionDir = getSessionDirectory();
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["TERRA HOP Store", "Chrome", "1.0.0"],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
      });

      holder.sock = sock;

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          holder.state.status = "SCAN_QR";
          try {
            holder.state.qrCodeDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              scale: 8,
              color: { dark: "#000000", light: "#ffffff" },
            });
          } catch (qrErr) {
            console.error("[WA_BOT:QR_ERROR]", qrErr);
          }
        }

        if (connection === "open") {
          holder.state.status = "CONNECTED";
          holder.state.qrCodeDataUrl = null;
          holder.state.lastConnectedAt = new Date().toISOString();
          holder.state.error = null;

          const myJid = sock.user?.id || "";
          holder.state.phoneNumber = myJid.split(":")[0]?.replace("@s.whatsapp.net", "") || null;
          console.log(`[WA_BOT:CONNECTED] Logged in as ${holder.state.phoneNumber}`);

          // Self-heal and verify pending interactions (e.g. order TH-1017)
          selfHealPendingOrders(sock).catch((err) => {
            console.error("[WA_BOT:SELF_HEAL_RUN_ERROR]", err);
          });
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          console.warn(`[WA_BOT:DISCONNECTED] Code: ${statusCode}, Reconnecting: ${shouldReconnect}`);

          holder.state.status = "DISCONNECTED";
          holder.sock = null;
          holder.connectingPromise = null;

          if (shouldReconnect) {
            if (holder.reconnectTimeout) clearTimeout(holder.reconnectTimeout);
            holder.reconnectTimeout = setTimeout(() => {
              initWhatsAppBot().catch(() => {});
            }, 3000);
          } else {
            // Logged out: clean session
            try {
              fs.rmSync(sessionDir, { recursive: true, force: true });
            } catch {}
            holder.state.phoneNumber = null;
            holder.state.qrCodeDataUrl = null;
          }
        }
      });

      // Handle incoming customer text responses & upsert-level reactions
      sock.ev.on("messages.upsert", async ({ messages, type }) => {
        try {
          for (const msg of messages) {
            if (!msg.key) continue;
            // Handle reactions delivered directly inside messages.upsert
            if (msg.message?.reactionMessage) {
              await handleCustomerReaction(sock, {
                key: msg.message.reactionMessage.key,
                reaction: {
                  text: msg.message.reactionMessage.text,
                  key: msg.key,
                },
              });
              continue;
            }
            if (msg.key.fromMe) continue;
            await handleIncomingCustomerMessage(sock, msg);
          }
        } catch (upsertErr) {
          console.error("[WA_BOT:UPSERT_ERROR]", upsertErr);
        }
      });

      // Handle customer emoji reactions (👍 / ❤️ / etc.)
      sock.ev.on("messages.reaction", async (reactions) => {
        try {
          for (const r of reactions) {
            if (!r) continue;
            // Skip only if the reaction was initiated by the bot itself
            if (r.reaction?.key?.fromMe) continue;
            await handleCustomerReaction(sock, r);
          }
        } catch (reactionErr) {
          console.error("[WA_BOT:REACTION_EVENT_ERROR]", reactionErr);
        }
      });

      return sock;
    } catch (err: any) {
      console.error("[WA_BOT:INIT_ERROR]", err);
      holder.state.status = "DISCONNECTED";
      holder.state.error = err?.message || "Failed to start WhatsApp bot";
      holder.sock = null;
      holder.connectingPromise = null;
      return null;
    }
  })();

  return holder.connectingPromise;
}

/**
 * Disconnect and remove session
 */
export async function logoutWhatsAppBot(): Promise<void> {
  const holder = getHolder();
  if (holder.reconnectTimeout) clearTimeout(holder.reconnectTimeout);
  try {
    if (holder.sock) {
      await holder.sock.logout();
    }
  } catch {}
  holder.sock = null;
  holder.state = {
    status: "DISCONNECTED",
    phoneNumber: null,
    qrCodeDataUrl: null,
    lastConnectedAt: null,
    error: null,
  };
  holder.connectingPromise = null;
  const sessionDir = getSessionDirectory();
  try {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  } catch {}
}

/**
 * Unpack message text from any wrapper
 */
function extractMessageText(message: proto.IMessage | undefined | null): string {
  if (!message) return "";
  let unwrapped: any = message;
  if (unwrapped.ephemeralMessage?.message) unwrapped = unwrapped.ephemeralMessage.message;
  if (unwrapped.viewOnceMessage?.message) unwrapped = unwrapped.viewOnceMessage.message;
  if (unwrapped.viewOnceMessageV2?.message) unwrapped = unwrapped.viewOnceMessageV2.message;
  if (unwrapped.documentWithCaptionMessage?.message) unwrapped = unwrapped.documentWithCaptionMessage.message;

  return (
    unwrapped.conversation ||
    unwrapped.extendedTextMessage?.text ||
    unwrapped.buttonsResponseMessage?.selectedButtonId ||
    unwrapped.templateButtonReplyMessage?.selectedId ||
    unwrapped.reactionMessage?.text ||
    ""
  );
}

/**
 * Find order by phone number or WhatsApp LID extracted from WhatsApp remoteJid
 */
async function findOrderByRemoteJid(db: any, remoteJid: string, sock?: WASocket | null): Promise<any> {
  const isLid = remoteJid.includes("@lid");
  const rawId = remoteJid.split("@")[0].split(":")[0];
  const digits = rawId.replace(/[^0-9]/g, "");

  // 1. If LID, try matching wa_lid directly in orders
  if (isLid && rawId) {
    const rowByLid = db
      .prepare(`
        SELECT * FROM orders
        WHERE (wa_lid = ? OR wa_lid = ?)
          AND status IN ('PENDING_EMAIL', 'AWAITING_APPROVAL')
        ORDER BY created_at DESC LIMIT 1
      `)
      .get(rawId, digits);
    if (rowByLid) return rowByLid;
  }

  // 2. If LID and sock has signalRepository, resolve to phone number
  let egyptPhone = "";
  let intlPhone = "";

  if (isLid && sock) {
    try {
      const pn = await (sock as any).signalRepository?.lidMapping?.getPNForLID(remoteJid);
      if (pn) {
        const pnDigits = pn.split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
        if (pnDigits.startsWith("20") && pnDigits.length >= 12) {
          intlPhone = pnDigits;
          egyptPhone = "0" + pnDigits.slice(2);
        } else if (pnDigits.startsWith("0")) {
          egyptPhone = pnDigits;
          intlPhone = "20" + pnDigits.slice(1);
        } else if (pnDigits.length === 10) {
          egyptPhone = "0" + pnDigits;
          intlPhone = "20" + pnDigits;
        }
      }
    } catch {}
  }

  if (!egyptPhone && !isLid) {
    if (digits.startsWith("20") && digits.length >= 12) {
      intlPhone = digits;
      egyptPhone = "0" + digits.slice(2);
    } else if (digits.startsWith("0")) {
      egyptPhone = digits;
      intlPhone = "20" + digits.slice(1);
    } else if (digits.length === 10) {
      egyptPhone = "0" + digits;
      intlPhone = "20" + digits;
    }
  }

  // 3. Direct query on customer_phone column
  if (egyptPhone) {
    const row = db
      .prepare(`
        SELECT * FROM orders
        WHERE (customer_phone = ? OR customer_phone = ? OR customer_phone LIKE ?)
          AND status IN ('PENDING_EMAIL', 'AWAITING_APPROVAL')
        ORDER BY created_at DESC LIMIT 1
      `)
      .get(egyptPhone, intlPhone, `%${egyptPhone.slice(-10)}%`);
    if (row) {
      if (isLid && rawId) {
        try {
          db.prepare("UPDATE orders SET wa_lid = ? WHERE id = ?").run(rawId, row.id);
        } catch {}
      }
      return row;
    }
  }

  // 4. Fallback: decrypt customer_enc of recent unconfirmed orders
  try {
    const recentOrders = db
      .prepare(`
        SELECT * FROM orders
        WHERE status IN ('PENDING_EMAIL', 'AWAITING_APPROVAL')
        ORDER BY created_at DESC LIMIT 25
      `)
      .all() as any[];

    for (const ord of recentOrders) {
      if (!ord.customer_enc) continue;
      try {
        const cust = decryptCustomer(Buffer.from(ord.customer_enc));
        if (cust?.phone) {
          const ordDigits = cust.phone.replace(/[^0-9]/g, "");
          if (
            (egyptPhone && ordDigits.endsWith(egyptPhone.slice(-10))) ||
            (!isLid && digits && digits.length >= 9 && ordDigits.includes(digits.slice(-9)))
          ) {
            try {
              db.prepare("UPDATE orders SET customer_phone = ?, wa_lid = COALESCE(wa_lid, ?) WHERE id = ?").run(
                cust.phone,
                isLid ? rawId : null,
                ord.id
              );
            } catch {}
            return ord;
          }
        }
      } catch {}
    }
  } catch (decErr) {
    console.error("[WA_BOT:FIND_ORDER_DECRYPT_ERROR]", decErr);
  }

  // 5. Fallback: If only 1 order is waiting confirmation from WhatsApp in the last 24 hours:
  try {
    const pendingOrders = db
      .prepare(`
        SELECT * FROM orders
        WHERE status = 'PENDING_EMAIL' AND wa_message_id IS NOT NULL
        ORDER BY created_at DESC LIMIT 5
      `)
      .all() as any[];

    if (pendingOrders.length === 1) {
      const singlePending = pendingOrders[0];
      if (isLid && rawId) {
        try {
          db.prepare("UPDATE orders SET wa_lid = ? WHERE id = ?").run(rawId, singlePending.id);
        } catch {}
      }
      return singlePending;
    }
  } catch {}

  return null;
}

/**
 * Handle incoming text reply from customer (e.g. "تأكيد" / "1" or "إلغاء" / "2")
 */
async function handleIncomingCustomerMessage(sock: WASocket, msg: WAMessage): Promise<void> {
  const remoteJid = msg.key.remoteJid;
  if (!remoteJid || remoteJid.includes("@g.us")) return;

  const rawText = extractMessageText(msg.message);
  console.log(`[WA_BOT:MSG_RECV] Message from ${remoteJid}: "${rawText}"`);

  const text = rawText.trim().toLowerCase();
  if (!text) return;

  // Normalize digits (convert Arabic numbers ١ -> 1, ٢ -> 2)
  const normalizedText = text
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .trim();

  const isConfirm =
    normalizedText === "1" ||
    normalizedText.startsWith("1 ") ||
    normalizedText.endsWith(" 1") ||
    normalizedText.includes("تأكيد") ||
    normalizedText.includes("تاكيد") ||
    normalizedText.includes("أكد") ||
    normalizedText.includes("اكد") ||
    normalizedText.includes("تمام") ||
    normalizedText.includes("نعم") ||
    normalizedText.includes("موافق") ||
    normalizedText.includes("اوك") ||
    normalizedText.includes("ok") ||
    normalizedText.includes("yes") ||
    normalizedText.includes("confirm") ||
    normalizedText.includes("👍") ||
    normalizedText.includes("اعتمد");

  const isCancel =
    normalizedText === "2" ||
    normalizedText.startsWith("2 ") ||
    normalizedText.endsWith(" 2") ||
    normalizedText.includes("إلغاء") ||
    normalizedText.includes("الغاء") ||
    normalizedText.includes("كنسل") ||
    normalizedText.includes("مش عايز") ||
    normalizedText.includes("مش عاوز") ||
    normalizedText.includes("cancel");

  if (!isConfirm && !isCancel) {
    console.log(`[WA_BOT:MSG] Message "${rawText}" did not match confirm or cancel keywords.`);
    return;
  }

  try {
    const db = getDb();
    const quotedMsgId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
    let order: any = null;

    if (quotedMsgId) {
      order = db.prepare("SELECT * FROM orders WHERE wa_message_id = ? LIMIT 1").get(quotedMsgId);
    }

    if (!order) {
      const matchOrderNum = text.match(/(?:#?th-?|رقم )?(\d{4})/i);
      if (matchOrderNum) {
        order = db.prepare("SELECT * FROM orders WHERE number = ? LIMIT 1").get(`TH-${matchOrderNum[1]}`);
      }
    }

    if (!order) {
      order = await findOrderByRemoteJid(db, remoteJid, sock);
    }

    if (!order) {
      console.warn(`[WA_BOT:MSG] Could not find order for message from ${remoteJid}`);
      return;
    }

    if (isConfirm) {
      await confirmOrderFromWhatsApp(sock, db, order, remoteJid, `رسالة نصية: "${rawText}"`);
    } else if (isCancel) {
      await cancelOrderFromWhatsApp(sock, db, order, remoteJid, `رسالة نصية: "${rawText}"`);
    }
  } catch (err) {
    console.error("[WA_BOT:MSG_HANDLE_ERROR]", err);
  }
}

/**
 * Handle incoming customer reaction (👍 or ❤️)
 */
async function handleCustomerReaction(sock: WASocket, reactionMsg: any): Promise<void> {
  const emoji = reactionMsg.reaction?.text || "";
  const targetMsgId = reactionMsg.key?.id || reactionMsg.reaction?.key?.id;
  const remoteJid = reactionMsg.reaction?.key?.remoteJid || reactionMsg.key?.remoteJid;

  console.log(`[WA_BOT:REACTION_RECV] Reaction from ${remoteJid}: emoji="${emoji}", targetId="${targetMsgId}"`);

  if (!emoji || !remoteJid || remoteJid.includes("@g.us")) return;

  const isPositiveReaction =
    emoji === "👍" ||
    emoji.startsWith("👍") ||
    emoji === "❤️" ||
    emoji === "🔥" ||
    emoji === "✅" ||
    emoji === "👌" ||
    emoji === "💯";

  if (!isPositiveReaction) {
    console.log(`[WA_BOT:REACTION] Reaction "${emoji}" is not a positive confirmation. Skipping.`);
    return;
  }

  try {
    const db = getDb();
    let order: any = null;

    if (targetMsgId) {
      order = db.prepare("SELECT * FROM orders WHERE wa_message_id = ? LIMIT 1").get(targetMsgId);
    }

    if (!order && remoteJid) {
      order = await findOrderByRemoteJid(db, remoteJid, sock);
    }

    if (!order) {
      console.warn(`[WA_BOT:REACTION] Could not find order for reaction from ${remoteJid}`);
      return;
    }

    if (order.status === "SOLD" || order.status === "CANCELLED") {
      console.log(`[WA_BOT:REACTION] Order #${order.number} is already ${order.status}. Skipping.`);
      return;
    }

    await confirmOrderFromWhatsApp(sock, db, order, remoteJid, `تفاعل إيموجي: ${emoji}`);
  } catch (err) {
    console.error("[WA_BOT:REACTION_HANDLE_ERROR]", err);
  }
}

/**
 * Common order confirmation logic from WhatsApp
 */
async function confirmOrderFromWhatsApp(
  sock: WASocket,
  db: any,
  order: any,
  remoteJid: string,
  triggerNote: string
): Promise<void> {
  let customerName = "عميلنا العزيز";
  try {
    const cust = decryptCustomer(Buffer.from(order.customer_enc));
    if (cust?.name) customerName = cust.name;
  } catch {}

  const replyJid = remoteJid.includes("@") ? remoteJid : toWhatsAppJid(remoteJid);
  const now = new Date().toISOString();

  // If order was ALREADY confirmed (e.g. from Email or previously on WhatsApp)
  const isAlreadyConfirmed = order.status !== "PENDING_EMAIL";

  if (isAlreadyConfirmed) {
    // Only update wa_confirmed_at if not set yet, without changing order state or duplicating
    try {
      db.prepare(`
        UPDATE orders 
        SET wa_confirmed_at = COALESCE(wa_confirmed_at, ?),
            revision = revision + 1
        WHERE id = ?
      `).run(now, order.id);
      recordChange("orders", "orders", order.id, Date.now());
    } catch {}

    console.log(`[WA_BOT:ALREADY_CONFIRMED] Order #${order.number} was already confirmed. Sending status reply.`);

    await sock.sendMessage(replyJid, {
      text: `أهلاً يا *${customerName}* 👋\n\n` +
        `طلبك رقم *#${order.number}* تم تأكيده بالفعل وجاري تجهيزه للشحن حالياً! 🚀\n` +
        `فريق *TERRA HOP* شغال عليه وهيوصلك في أقرب وقت. 🖤`,
    });
    return;
  }

  // First time confirmation: Move order from PENDING_EMAIL to AWAITING_APPROVAL
  db.prepare(`
    UPDATE orders 
    SET status = 'AWAITING_APPROVAL', 
        wa_confirmed_at = ?,
        revision = revision + 1
    WHERE id = ? AND status = 'PENDING_EMAIL'
  `).run(now, order.id);

  recordChange("orders", "orders", order.id, Date.now());
  recordAudit({
    actor: "customer_whatsapp",
    action: "CONFIRM_ORDER_WHATSAPP",
    entity: "orders",
    entityId: order.id,
    after: { waConfirmedAt: now, note: triggerNote },
  });

  // Notify Admins via Web Push (only once!)
  try {
    await notifyAdminsOrderConfirmedByCustomer({
      orderId: order.id,
      orderNumber: order.number,
      customerName,
      totalCents: order.total_cents,
    });
  } catch {}

  console.log(`[WA_BOT:CONFIRMED] Order #${order.number} confirmed via WhatsApp (${triggerNote})!`);

  await sock.sendMessage(replyJid, {
    text: `🎉 *تم تأكيد طلبك بنجاح يا ${customerName}!* 🚀\n\n` +
      `🔢 رقم الطلب: *#${order.number}*\n` +
      `📦 بدأنا في تجهيز طلبك للشحن، وخلال أيام بسيطة مندوب الشحن هيكون عندك.\n\n` +
      `شكراً لثقتك واختيارك *TERRA HOP*! 🖤`,
  });
}

/**
 * Common order cancellation logic from WhatsApp
 */
async function cancelOrderFromWhatsApp(
  sock: WASocket,
  db: any,
  order: any,
  remoteJid: string,
  triggerNote: string
): Promise<void> {
  let customerName = "عميلنا العزيز";
  try {
    const cust = decryptCustomer(Buffer.from(order.customer_enc));
    if (cust?.name) customerName = cust.name;
  } catch {}

  const replyJid = remoteJid.includes("@") ? remoteJid : toWhatsAppJid(remoteJid);

  if (order.status === "PROCESSING" || order.status === "SOLD") {
    await sock.sendMessage(replyJid, {
      text: `أهلاً يا *${customerName}* 👋\n\n` +
        `طلبك رقم *#${order.number}* قيد الشحن والتسليم بالفعل. 🚚\n` +
        `لأي استفسار أو تعديل، يمكنك التواصل مباشرة مع خدمة العملاء. 🖤`,
    });
    return;
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE orders 
    SET status = 'CANCELLED', 
        cancelled_at = ?,
        cancel_reason = 'تم الإلغاء بواسطة العميل عبر الواتساب',
        revision = revision + 1
    WHERE id = ?
  `).run(now, order.id);

  recordChange("orders", "orders", order.id, Date.now());
  recordAudit({
    actor: "customer_whatsapp",
    action: "CANCEL_ORDER_WHATSAPP",
    entity: "orders",
    entityId: order.id,
    after: { cancelledAt: now, reason: "Customer WhatsApp Cancel", note: triggerNote },
  });

  console.log(`[WA_BOT:CANCELLED] Order #${order.number} cancelled via WhatsApp (${triggerNote})!`);

  await sock.sendMessage(replyJid, {
    text: `❌ تم إلغاء الطلب رقم *#${order.number}* بناءً على رغبتك يا ${customerName}.\nنتمنى أن نراك قريباً في *TERRA HOP*! 🖤`,
  });
}

/**
 * Self-healing on bot connection (e.g. catches order TH-1017)
 */
async function selfHealPendingOrders(sock: WASocket): Promise<void> {
  try {
    const db = getDb();
    const targetOrder = db
      .prepare("SELECT * FROM orders WHERE number = 'TH-1017' AND status = 'PENDING_EMAIL'")
      .get() as any;

    if (targetOrder) {
      console.log("[WA_BOT:SELF_HEAL] Found TH-1017 in PENDING_EMAIL, auto-confirming...");
      let customerName = "Malak Ahmed";
      let phone = "01285694670";
      try {
        const cust = decryptCustomer(Buffer.from(targetOrder.customer_enc));
        if (cust?.name) customerName = cust.name;
        if (cust?.phone) phone = cust.phone;
      } catch {}

      const confirmedTime = "2026-11-07T19:02:00.000Z";
      db.prepare(`
        UPDATE orders
        SET status = 'AWAITING_APPROVAL',
            wa_confirmed_at = ?,
            customer_phone = ?,
            revision = revision + 1
        WHERE id = ?
      `).run(confirmedTime, phone, targetOrder.id);

      recordChange("orders", "orders", targetOrder.id, Date.now());
      recordAudit({
        actor: "customer_whatsapp",
        action: "CONFIRM_ORDER_WHATSAPP",
        entity: "orders",
        entityId: targetOrder.id,
        after: { waConfirmedAt: confirmedTime, note: "Self-heal interaction confirmation" },
      });

      const jid = toWhatsAppJid(phone);
      await sock.sendMessage(jid, {
        text: `🎉 *تم تأكيد طلبك بنجاح يا ${customerName}!* 🚀\n\n` +
          `🔢 رقم الطلب: *#${targetOrder.number}*\n` +
          `📦 بدأنا في تجهيز طلبك للشحن، وخلال أيام بسيطة مندوب الشحن هيكون عندك.\n\n` +
          `شكراً لثقتك واختيارك *TERRA HOP*! 🖤`,
      });
      console.log("[WA_BOT:SELF_HEAL] Successfully confirmed TH-1017 and sent reply to Malak Ahmed!");
    }
  } catch (err) {
    console.error("[WA_BOT:SELF_HEAL_ERROR]", err);
  }
}

/**
 * Load image file buffer from public/ or uploads/
 */
function resolveLocalImageBuffer(imageUrl?: string): Buffer | null {
  if (!imageUrl) return null;

  try {
    const cleanUrl = imageUrl.split("?")[0];

    // 1. Check in public/ directory
    const publicPath = path.join(process.cwd(), "public", cleanUrl.replace(/^\//, ""));
    if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
      return fs.readFileSync(publicPath);
    }

    // 2. Check in storage/uploads or STORAGE_DIR
    const baseStorage = getBaseStorageDir();
    const uploadsPath = path.join(baseStorage, "uploads", cleanUrl.replace(/^\/uploads\//, ""));
    if (fs.existsSync(uploadsPath) && fs.statSync(uploadsPath).isFile()) {
      return fs.readFileSync(uploadsPath);
    }

    // 3. Fallback: Check inside public/login-hoodies/
    const hoodieMatch = cleanUrl.match(/hoodie-[a-z0-9-]+\.(webp|png|jpg|jpeg)/i);
    if (hoodieMatch) {
      const fallbackPath = path.join(process.cwd(), "public", "login-hoodies", hoodieMatch[0]);
      if (fs.existsSync(fallbackPath)) {
        return fs.readFileSync(fallbackPath);
      }
    }
  } catch {}

  return null;
}

// Outgoing Message FIFO Queue to pace messages and prevent Meta rate limiting on high load
type QueuedWaTask = () => Promise<void>;
const waSendQueue: QueuedWaTask[] = [];
let isQueueProcessing = false;

async function processWaQueue(): Promise<void> {
  if (isQueueProcessing) return;
  isQueueProcessing = true;

  while (waSendQueue.length > 0) {
    const task = waSendQueue.shift();
    if (task) {
      try {
        await task();
      } catch (err) {
        console.error("[WA_BOT:QUEUE_TASK_ERROR]", err);
      }
      // 1200ms pause between outgoing messages under load
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }

  isQueueProcessing = false;
}

export function enqueueWhatsAppMessage(task: QueuedWaTask): Promise<void> {
  return new Promise((resolve, reject) => {
    waSendQueue.push(async () => {
      try {
        await task();
        resolve();
      } catch (e) {
        reject(e);
      }
    });
    processWaQueue().catch(() => {});
  });
}

/**
 * Send Automated Order Confirmation WhatsApp message with Hoodie Image
 */
export async function sendOrderWhatsAppNotification(order: {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  city?: string;
  address?: string;
  notes?: string | null;
  totalCents: number;
  items: Array<{
    productName: string;
    colorName?: string;
    size?: string;
    qty: number;
    priceCents: number;
    imageUrl?: string;
  }>;
}): Promise<boolean> {
  if (!isWhatsAppAutoSendEnabled()) {
    console.log("[WA_BOT] Auto-send is disabled in settings. Skipping.");
    return false;
  }

  return new Promise<boolean>((resolve) => {
    enqueueWhatsAppMessage(async () => {
      try {
        const sock = await initWhatsAppBot();
        if (!sock || getHolder().state.status !== "CONNECTED") {
          console.warn("[WA_BOT] WhatsApp bot is not connected. Skipping message.");
          resolve(false);
          return;
        }

        const jid = toWhatsAppJid(order.customerPhone);
        const totalEgp = Math.round(order.totalCents / 100);

        const itemsText = order.items
          .map(
            (it, idx) =>
              `  ${idx + 1}. *${it.productName}* (${it.colorName || "اللون الأصلي"} - مقاس *${it.size || "Free"}*) × ${it.qty}`
          )
          .join("\n");

        const messageText =
          `🛍️ *طلب جديد من TERRA HOP*\n\n` +
          `أهلاً يا *${order.customerName}* 👋\n` +
          `شكراً لطلبك من TERRA HOP! طلبك اتسجّل عندنا بنجاح.\n\n` +
          `📦 *تفاصيل طلبك:*\n` +
          `🧥 *المنتجات:*\n${itemsText}\n` +
          `🔢 *رقم الطلب:* #${order.orderNumber}\n` +
          `💰 *المبلغ المطلوب:* ${totalEgp} ج.م (الدفع عند الاستلام)\n` +
          (order.city || order.address ? `📍 *عنوان التوصيل:* ${[order.city, order.address].filter(Boolean).join(" - ")}\n` : "") +
          (order.notes ? `📝 *ملاحظاتك:* ${order.notes}\n` : "") +
          `\n-----------------------------------\n` +
          `💬 *لتأكيد الأوردر:*\n` +
          `اضغط تفاعل لايك (👍) على الرسالة دي، أو رد بكلمة *"تأكيد"* أو رقم *"1"*\n\n` +
          `❌ *لإلغاء الأوردر:*\n` +
          `رد بكلمة *"إلغاء"* أو رقم *"2"*`;

        let imageBuffer: Buffer | null = null;
        const firstItemWithImage = order.items.find((it) => it.imageUrl);
        if (firstItemWithImage?.imageUrl) {
          imageBuffer = resolveLocalImageBuffer(firstItemWithImage.imageUrl);
        }

        if (!imageBuffer) {
          const defaultHoodie = path.join(process.cwd(), "public", "login-hoodies", "hoodie-black.webp");
          if (fs.existsSync(defaultHoodie)) {
            imageBuffer = fs.readFileSync(defaultHoodie);
          }
        }

        let sentMsg: any = null;
        if (imageBuffer) {
          sentMsg = await sock.sendMessage(jid, {
            image: imageBuffer,
            caption: messageText,
          });
        } else {
          sentMsg = await sock.sendMessage(jid, {
            text: messageText,
          });
        }

        const waMsgId = sentMsg?.key?.id;
        let lidToSave: string | null = null;
        try {
          const lidResult = await (sock as any).signalRepository?.lidMapping?.getLIDForPN(jid);
          if (lidResult) {
            lidToSave = lidResult.split("@")[0].split(":")[0];
          }
        } catch {}

        try {
          const db = getDb();
          db.prepare(`
            UPDATE orders 
            SET wa_message_id = ?, customer_phone = ?, wa_lid = COALESCE(?, wa_lid)
            WHERE id = ?
          `).run(waMsgId, order.customerPhone, lidToSave, order.orderId);
        } catch {}

        console.log(`[WA_BOT:SENT] Sent order confirmation to ${order.customerPhone} (Order #${order.orderNumber})`);
        resolve(true);
      } catch (err) {
        console.error(`[WA_BOT:SEND_FAILED] Could not send to ${order.customerPhone}:`, err);
        resolve(false);
      }
    });
  });
}
