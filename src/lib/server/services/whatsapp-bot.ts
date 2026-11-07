import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  type WASocket,
  type WAMessage,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import path from "path";
import fs from "fs";
import { getBaseStorageDir, getDb, recordAudit, recordChange } from "../db";
import { decryptCustomer } from "../vault";

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

      // Handle incoming customer text responses
      sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        for (const msg of messages) {
          if (!msg.key || msg.key.fromMe) continue;
          await handleIncomingCustomerMessage(sock, msg);
        }
      });

      // Handle customer emoji reactions (👍 / ❤️)
      sock.ev.on("messages.reaction", async (reactions) => {
        for (const r of reactions) {
          if (!r.key || r.key.fromMe) continue;
          await handleCustomerReaction(sock, r);
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
 * Handle incoming text reply from customer (e.g. "تأكيد" / "1" or "إلغاء" / "2")
 */
async function handleIncomingCustomerMessage(sock: WASocket, msg: WAMessage): Promise<void> {
  const remoteJid = msg.key.remoteJid;
  if (!remoteJid || remoteJid.includes("@g.us")) return;

  const rawText =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    "";
  const text = rawText.trim().toLowerCase();
  if (!text) return;

  const phoneDigits = remoteJid.replace("@s.whatsapp.net", "").replace(/^20/, "0");
  const quotedMsgId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;

  const isConfirm =
    text === "1" ||
    text === "تأكيد" ||
    text === "تاكيد" ||
    text === "أكد" ||
    text === "اكد" ||
    text === "تمام" ||
    text === "نعم" ||
    text === "موافق" ||
    text === "confirm";

  const isCancel =
    text === "2" ||
    text === "إلغاء" ||
    text === "الغاء" ||
    text === "كنسل" ||
    text === "مش عايز" ||
    text === "cancel";

  if (!isConfirm && !isCancel) return;

  try {
    const db = getDb();
    let order: any = null;

    if (quotedMsgId) {
      order = db.prepare("SELECT * FROM orders WHERE wa_message_id = ? LIMIT 1").get(quotedMsgId);
    }
    if (!order) {
      order = db
        .prepare(`
          SELECT * FROM orders 
          WHERE (customer_phone = ? OR customer_phone = ?)
            AND status IN ('AWAITING_APPROVAL', 'PENDING_EMAIL')
          ORDER BY created_at DESC LIMIT 1
        `)
        .get(phoneDigits, `0${phoneDigits.slice(-10)}`);
    }

    if (!order) return;

    let customerName = "عميلنا العزيز";
    try {
      const cust = decryptCustomer(Buffer.from(order.customer_enc));
      if (cust?.name) customerName = cust.name;
    } catch {}

    const now = new Date().toISOString();

    if (isConfirm) {
      db.prepare(`
        UPDATE orders 
        SET status = 'AWAITING_APPROVAL', 
            wa_confirmed_at = ?,
            revision = revision + 1
        WHERE id = ?
      `).run(now, order.id);

      recordChange("orders", "orders", order.id, Date.now());
      recordAudit({
        actor: "customer_whatsapp",
        action: "CONFIRM_ORDER_WHATSAPP",
        entity: "orders",
        entityId: order.id,
        after: { waConfirmedAt: now, message: text },
      });

      await sock.sendMessage(remoteJid, {
        text: `🎉 *تم تأكيد طلبك بنجاح يا ${customerName}!* 🚀\n\nرقم الطلب: *#${order.number}*\nفريق TERRA HOP بدأ يجهز طلبك، وخلال أيام بسيطة مندوب الشحن هيكون عندك. شكراً لثقتك فينا! 🖤`,
      });
    } else if (isCancel) {
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
        after: { cancelledAt: now, reason: "Customer WhatsApp Cancel" },
      });

      await sock.sendMessage(remoteJid, {
        text: `تم إلغاء الطلب رقم *#${order.number}* بناءً على رغبتك يا ${customerName}.\nنتمنى أن نراك قريباً في TERRA HOP! 🖤`,
      });
    }
  } catch (err) {
    console.error("[WA_BOT:MSG_HANDLE_ERROR]", err);
  }
}

/**
 * Handle incoming customer reaction (👍 or ❤️)
 */
async function handleCustomerReaction(sock: WASocket, reactionMsg: any): Promise<void> {
  const emoji = reactionMsg.reaction?.text;
  const targetMsgId = reactionMsg.reaction?.key?.id;
  const remoteJid = reactionMsg.key?.remoteJid;

  if (!emoji || !targetMsgId || !remoteJid) return;

  const isPositiveReaction = emoji === "👍" || emoji === "❤️" || emoji === "🔥";
  if (!isPositiveReaction) return;

  try {
    const db = getDb();
    const order = db.prepare("SELECT * FROM orders WHERE wa_message_id = ? LIMIT 1").get(targetMsgId) as any;
    if (!order || order.status === "SOLD" || order.status === "CANCELLED") return;

    let customerName = "عميلنا العزيز";
    try {
      const cust = decryptCustomer(Buffer.from(order.customer_enc));
      if (cust?.name) customerName = cust.name;
    } catch {}

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE orders 
      SET status = 'AWAITING_APPROVAL', 
          wa_confirmed_at = ?,
          revision = revision + 1
      WHERE id = ?
    `).run(now, order.id);

    recordChange("orders", "orders", order.id, Date.now());
    recordAudit({
      actor: "customer_whatsapp",
      action: "CONFIRM_ORDER_REACTION",
      entity: "orders",
      entityId: order.id,
      after: { waConfirmedAt: now, emoji },
    });

    await sock.sendMessage(remoteJid, {
      text: `👍 *شكراً لتأكيدك يا ${customerName}!* تم اعتماد تأكيدك للطلب رقم *#${order.number}* وجاري التجهيز للشحن. 🚀`,
    });
  } catch (err) {
    console.error("[WA_BOT:REACTION_HANDLE_ERROR]", err);
  }
}

/**
 * Load image file buffer from public/ or uploads/
 */
function resolveLocalImageBuffer(imageUrl?: string): Buffer | null {
  if (!imageUrl) return null;

  try {
    // If it's a relative path starting with /
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

  const sock = await initWhatsAppBot();
  if (!sock || getHolder().state.status !== "CONNECTED") {
    console.warn("[WA_BOT] WhatsApp bot is not connected. Skipping message.");
    return false;
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

  try {
    // Attempt to attach the hoodie image
    let imageBuffer: Buffer | null = null;
    const firstItemWithImage = order.items.find((it) => it.imageUrl);
    if (firstItemWithImage?.imageUrl) {
      imageBuffer = resolveLocalImageBuffer(firstItemWithImage.imageUrl);
    }

    // Default fallback hoodie image if not found
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
    if (waMsgId) {
      try {
        const db = getDb();
        db.prepare("UPDATE orders SET wa_message_id = ? WHERE id = ?").run(waMsgId, order.orderId);
      } catch {}
    }

    console.log(`[WA_BOT:SENT] Sent order confirmation to ${order.customerPhone} (Order #${order.orderNumber})`);
    return true;
  } catch (err) {
    console.error(`[WA_BOT:SEND_FAILED] Could not send to ${order.customerPhone}:`, err);
    return false;
  }
}
