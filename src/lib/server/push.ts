import webpush from "web-push";
import { getDb } from "./db";
import crypto from "crypto";

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@terra-hop.com";

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

/**
 * Retrieves existing VAPID keys from environment or SQLite meta table.
 * If none exist, auto-generates and persists a pair in SQLite.
 */
export function getOrGenerateVapidKeys(): VapidKeys {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  }

  const db = getDb();
  const pubRow = db.prepare("SELECT value FROM meta WHERE key = 'vapid_public_key'").get() as { value: string } | undefined;
  const privRow = db.prepare("SELECT value FROM meta WHERE key = 'vapid_private_key'").get() as { value: string } | undefined;

  if (pubRow?.value && privRow?.value) {
    return {
      publicKey: pubRow.value,
      privateKey: privRow.value,
    };
  }

  // Generate new keypair and persist in DB
  const generated = webpush.generateVAPIDKeys();
  const insertMeta = db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)");
  insertMeta.run("vapid_public_key", generated.publicKey);
  insertMeta.run("vapid_private_key", generated.privateKey);

  return generated;
}

/**
 * Configure web-push details lazily
 */
function ensureVapidConfigured() {
  const keys = getOrGenerateVapidKeys();
  webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);
  return keys;
}

export function getVapidPublicKey(): string {
  const keys = ensureVapidConfigured();
  return keys.publicKey;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export function saveAdminSubscription(sub: PushSubscriptionData, userAgent?: string): boolean {
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return false;
  }

  const db = getDb();
  const id = `sub_${crypto.randomUUID()}`;
  const now = Date.now();

  db.prepare(`
    INSERT INTO admin_push_subscriptions (id, endpoint, p256dh, auth, user_agent, created_at, last_used_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent,
      last_used_at = excluded.last_used_at
  `).run(id, sub.endpoint, sub.keys.p256dh, sub.keys.auth, userAgent || null, now, now);

  return true;
}

export function deleteAdminSubscription(endpoint: string): boolean {
  if (!endpoint) return false;
  const db = getDb();
  const res = db.prepare("DELETE FROM admin_push_subscriptions WHERE endpoint = ?").run(endpoint);
  return res.changes > 0;
}

export function getAdminSubscriptionsCount(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as cnt FROM admin_push_subscriptions").get() as { cnt: number };
  return row?.cnt || 0;
}

export interface OrderNotificationPayload {
  orderId: string;
  orderNumber: string;
  customerName: string;
  city?: string;
  totalCents: number;
  itemsCount: number;
  firstItemName?: string;
}

/**
 * Broadcast an order notification to all registered admin devices.
 * Automatically purges subscriptions that return 410 Gone or 404 Not Found.
 */
export async function notifyAdminsNewOrder(order: OrderNotificationPayload): Promise<{ sent: number; failed: number }> {
  ensureVapidConfigured();
  const db = getDb();

  const subscriptions = db.prepare(`
    SELECT id, endpoint, p256dh, auth FROM admin_push_subscriptions
  `).all() as { id: string; endpoint: string; p256dh: string; auth: string }[];

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const adminPath = process.env.ADMIN_PATH || process.env.ADMIN_KEY || "k7q2-vault-9xm4";
  const targetUrl = `/${adminPath}/orders/${order.orderId}`;
  const totalEgp = Math.round(order.totalCents / 100);

  const payload = JSON.stringify({
    title: `🛒 طلب شراء جديد: ${order.orderNumber}`,
    body: `العميل: ${order.customerName}${order.city ? ` (${order.city})` : ""} | الإجمالي: ${totalEgp} ج.م | ${order.itemsCount} قطعة${order.firstItemName ? ` (${order.firstItemName})` : ""}`,
    icon: "/icon.png",
    badge: "/icon.png",
    tag: `order-${order.orderId}`,
    data: {
      url: targetUrl,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      timestamp: Date.now(),
    },
  });

  let sent = 0;
  let failed = 0;
  const deleteSub = db.prepare("DELETE FROM admin_push_subscriptions WHERE id = ?");

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSub, payload, {
          TTL: 60 * 60 * 24, // 24 hours
          urgency: "high",
        });
        sent++;
      } catch (err: any) {
        failed++;
        // 410 Gone or 404 Not Found means the subscription expired or was cancelled by user
        if (err.statusCode === 410 || err.statusCode === 404) {
          deleteSub.run(sub.id);
        }
      }
    }),
  );

  return { sent, failed };
}

/**
 * Send a test notification to a specific admin subscription
 */
export async function sendTestNotification(sub: PushSubscriptionData): Promise<boolean> {
  ensureVapidConfigured();
  const adminPath = process.env.ADMIN_PATH || process.env.ADMIN_KEY || "k7q2-vault-9xm4";

  const payload = JSON.stringify({
    title: "🔔 إشعار تجريبي من TERRA HOP",
    body: "تهانينا! نظام الإشعارات الفورية يعمل بنجاح على هذا المتصفح حتى لو تم إغلاق الموقع.",
    icon: "/icon.png",
    badge: "/icon.png",
    tag: "test-notification",
    data: {
      url: `/${adminPath}/dashboard`,
      timestamp: Date.now(),
    },
  });

  await webpush.sendNotification(sub, payload, {
    TTL: 60,
    urgency: "high",
  });

  return true;
}

export interface AmbassadorGoalPayload {
  ambassadorName: string;
  code: string;
  targetCount: number;
  currentCount: number;
}

/**
 * Notify all admins when an ambassador referral code reaches the maximum usage target
 */
export async function notifyAdminsAmbassadorGoalReached(data: AmbassadorGoalPayload): Promise<void> {
  ensureVapidConfigured();
  const db = getDb();

  const subscriptions = db.prepare(`
    SELECT id, endpoint, p256dh, auth FROM admin_push_subscriptions
  `).all() as { id: string; endpoint: string; p256dh: string; auth: string }[];

  if (subscriptions.length === 0) return;

  const adminPath = process.env.ADMIN_PATH || process.env.ADMIN_KEY || "k7q2-vault-9xm4";
  const targetUrl = `/${adminPath}/ambassadors`;

  const payload = JSON.stringify({
    title: `🎯 تم وصول ${data.ambassadorName} للحد المطلوب!`,
    body: `وصل كود (${data.code}) إلى ${data.currentCount} من ${data.targetCount} استخدام/مبيعة بنجاح! يُرجى إعطاؤه المكافأة.`,
    icon: "/icon.png",
    badge: "/icon.png",
    tag: `goal-${data.code}-${data.targetCount}`,
    data: {
      url: targetUrl,
      timestamp: Date.now(),
    },
  });

  await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 * 60 * 24, urgency: "high" }
      )
    )
  );
}

export interface OrderConfirmedPayload {
  orderId: string;
  orderNumber: string;
  customerName: string;
  totalCents: number;
}

/**
 * Notify admins when a customer clicks the confirmation link in their email.
 */
export async function notifyAdminsOrderConfirmedByCustomer(data: OrderConfirmedPayload): Promise<void> {
  ensureVapidConfigured();
  const db = getDb();

  const subscriptions = db.prepare(`
    SELECT id, endpoint, p256dh, auth FROM admin_push_subscriptions
  `).all() as { id: string; endpoint: string; p256dh: string; auth: string }[];

  if (subscriptions.length === 0) return;

  const adminPath = process.env.ADMIN_PATH || process.env.ADMIN_KEY || "k7q2-vault-9xm4";
  const targetUrl = `/${adminPath}/orders/${data.orderId}`;
  const total = Math.round(data.totalCents / 100);

  const payload = JSON.stringify({
    title: `✅ العميل أكد طلبه! (#${data.orderNumber})`,
    body: `قام ${data.customerName} بتأكيد طلبه رسمياً عبر الإيميل (${total} ج.م). الطلب جاهز للمراجعة والموافقة.`,
    icon: "/icon.png",
    badge: "/icon.png",
    tag: `confirm-${data.orderNumber}`,
    data: {
      url: targetUrl,
      orderNumber: data.orderNumber,
      timestamp: Date.now(),
    },
  });

  await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 * 60 * 24, urgency: "high" }
      )
    )
  );
}
