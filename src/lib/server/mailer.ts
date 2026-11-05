import crypto from "crypto";
import { getDb } from "./db";

const DEFAULT_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || process.env.GMAIL_USER || "terr3hop@gmail.com";
const DEFAULT_SENDER_NAME = "TERRA HOP";

const APP_BASE_URL =
  process.env.APP_BASE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : "https://terra-hop-production.up.railway.app");

/**
 * Retrieve Brevo API Key and sender settings from DB settings or process.env
 */
export function getBrevoConfig(): {
  apiKey: string;
  senderEmail: string;
  senderName: string;
} {
  let apiKey = process.env.BREVO_API_KEY || "";
  let senderEmail = DEFAULT_SENDER_EMAIL;
  let senderName = DEFAULT_SENDER_NAME;

  try {
    const db = getDb();
    const rows = db
      .prepare("SELECT key, value FROM settings WHERE group_key = 'email'")
      .all() as Array<{ key: string; value: string }>;
    for (const r of rows) {
      if (r.key === "brevo_api_key" && r.value) apiKey = r.value.trim();
      if (r.key === "sender_email" && r.value) senderEmail = r.value.trim();
      if (r.key === "sender_name" && r.value) senderName = r.value.trim();
    }
  } catch {}

  return { apiKey, senderEmail, senderName };
}

/**
 * Send email via Brevo REST API over HTTPS Port 443.
 * Completely immune to cloud firewall / SMTP port blocking.
 */
export async function sendBrevoEmail({
  to,
  subject,
  html,
  recipientName,
}: {
  to: string;
  subject: string;
  html: string;
  recipientName?: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const config = getBrevoConfig();

  if (!config.apiKey) {
    const msg = "لم يتم إدخال مفتاح Brevo API Key بعد. يرجى إضافة المفتاح في لوحة التحكم لتفعيل إرسال الإيميلات للعملاء.";
    console.warn(`[BREVO:WAITING_KEY] ${msg}`);
    return { ok: false, error: msg };
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": config.apiKey,
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: config.senderName,
          email: config.senderEmail,
        },
        to: [
          {
            email: to,
            name: recipientName || undefined,
          },
        ],
        subject,
        htmlContent: html,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      console.log(`[BREVO:SUCCESS] Sent email to ${to}. MessageId: ${data?.messageId}`);
      return { ok: true, messageId: data?.messageId };
    }

    const errDesc = data?.message || `Brevo API error (${res.status})`;
    console.error(`[BREVO:ERROR] Failed to send email to ${to}:`, errDesc);
    return { ok: false, error: errDesc };
  } catch (err: any) {
    console.error(`[BREVO:NETWORK_ERROR] Network request failed to Brevo API:`, err);
    return { ok: false, error: err?.message || "فشل الاتصال بخدمة Brevo." };
  }
}

/**
 * Generate a tamper-proof HMAC confirmation token for an order.
 */
export function generateOrderConfirmationToken(orderId: string, createdAt: string): string {
  const secret = process.env.SESSION_SECRET || "terra-hop-secure-order-token-2026";
  return crypto
    .createHmac("sha256", secret)
    .update(`${orderId}:${createdAt}`)
    .digest("hex");
}

/**
 * Verify an order confirmation token.
 */
export function verifyOrderConfirmationToken(
  orderId: string,
  createdAt: string,
  token: string
): boolean {
  if (!orderId || !createdAt || !token) return false;
  const expected = generateOrderConfirmationToken(orderId, createdAt);
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export interface EmailOrderData {
  id: string;
  number: string;
  createdAt: string;
  customer: {
    name: string;
    phone: string;
    email: string;
    city: string;
    address: string;
  };
  items: Array<{
    name: string;
    color?: string;
    size?: string;
    qty: number;
    priceCents: number;
    image?: string;
  }>;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
}

/**
 * Send invoice and order confirmation request email to customer via Brevo.
 */
export async function sendOrderInvoiceEmail(order: EmailOrderData): Promise<boolean> {
  if (!order.customer.email) return false;

  const confirmToken = generateOrderConfirmationToken(order.id, order.createdAt);
  const confirmUrl = `${APP_BASE_URL}/order/confirm?id=${encodeURIComponent(order.id)}&token=${encodeURIComponent(confirmToken)}`;
  const storeUrl = APP_BASE_URL;

  const subtotalFormatted = (order.subtotalCents / 100).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
  const shippingFormatted =
    order.shippingCents === 0
      ? "مجاني"
      : `${(order.shippingCents / 100).toLocaleString("ar-EG", { minimumFractionDigits: 2 })} ج.م`;
  const discountFormatted =
    order.discountCents > 0
      ? `${(order.discountCents / 100).toLocaleString("ar-EG", { minimumFractionDigits: 2 })} ج.م`
      : null;
  const totalFormatted = (order.totalCents / 100).toLocaleString("ar-EG", { minimumFractionDigits: 2 });

  const itemsHtml = order.items
    .map((item) => {
      const price = ((item.priceCents * item.qty) / 100).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
      const meta = [item.color, item.size ? `مقاس: ${item.size}` : null, `الكمية: ${item.qty}`]
        .filter(Boolean)
        .join(" · ");
      return `
        <tr>
          <td style="padding: 14px 0; border-bottom: 1px solid #262626; text-align: right; vertical-align: top;">
            <div style="font-weight: 700; color: #ffffff; font-size: 15px; margin-bottom: 4px;">${item.name}</div>
            <div style="color: #a3a3a3; font-size: 13px;">${meta}</div>
          </td>
          <td style="padding: 14px 0; border-bottom: 1px solid #262626; text-align: left; vertical-align: top; font-weight: 700; color: #ffffff; font-size: 15px; white-space: nowrap;">
            ${price} ج.م
          </td>
        </tr>
      `;
    })
    .join("");

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>فاتورة وتأكيد الطلب #${order.number}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0c0c0c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e5e5e5; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0c0c0c; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #171717; border-radius: 12px; border: 1px solid #262626; overflow: hidden; text-align: right;" cellpadding="0" cellspacing="0">
          
          <!-- Logo & Header -->
          <tr>
            <td style="padding: 36px 32px 24px; text-align: center; border-bottom: 1px solid #262626; background: linear-gradient(180deg, #1f1f1f 0%, #171717 100%);">
              <div style="font-size: 32px; font-weight: 900; letter-spacing: 4px; color: #ffffff; font-family: sans-serif;">TERRA HOP</div>
              <div style="font-size: 11px; letter-spacing: 3px; color: #e11d48; font-weight: 700; text-transform: uppercase; margin-top: 4px;">Streetwear Redefined</div>
            </td>
          </tr>

          <!-- Main Greeting & Confirm Action -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              <div style="color: #a3a3a3; font-size: 13px; font-weight: 600; margin-bottom: 6px;">طلب رقم: <span style="color: #ffffff; font-family: monospace;">${order.number}</span></div>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0 0 12px; line-height: 1.4;">شكراً لطلبك، ${order.customer.name}! 🎉</h1>
              <p style="color: #d4d4d4; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
                لقد استلمنا بيانات طلبك بنجاح. لبدء تجهيز قطعك وحجزها لك، يرجى الضغط على زر <strong>تأكيد الأوردر</strong> أدناه:
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${confirmUrl}" style="background-color: #ffffff; color: #000000; display: inline-block; padding: 16px 36px; border-radius: 8px; font-size: 16px; font-weight: 800; text-decoration: none; text-align: center; box-shadow: 0 4px 14px rgba(255,255,255,0.15);">
                      ✓ تأكيد الأوردر الآن
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #888888; font-size: 12px; line-height: 1.6; margin: 0; text-align: center;">
                إذا كان الزر لا يعمل معك، يمكنك الضغط مباشرة على هذا الرابط:<br>
                <a href="${confirmUrl}" style="color: #e11d48; text-decoration: underline; word-break: break-all;">${confirmUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Items Summary -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <h2 style="color: #ffffff; font-size: 17px; font-weight: 700; border-bottom: 2px solid #e11d48; padding-bottom: 8px; margin: 0 0 16px;">
                ملخص الطلب
              </h2>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                ${itemsHtml}
              </table>

              <!-- Totals Table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px; border-top: 1px solid #262626; padding-top: 14px;">
                <tr>
                  <td style="color: #a3a3a3; font-size: 14px; padding: 5px 0;">المجموع الفرعي:</td>
                  <td style="color: #ffffff; font-size: 14px; padding: 5px 0; text-align: left; font-weight: 600;">${subtotalFormatted} ج.م</td>
                </tr>
                ${
                  discountFormatted
                    ? `<tr>
                        <td style="color: #e11d48; font-size: 14px; padding: 5px 0;">خصم كود الإحالة/البرومو:</td>
                        <td style="color: #e11d48; font-size: 14px; padding: 5px 0; text-align: left; font-weight: 600;">-${discountFormatted}</td>
                      </tr>`
                    : ""
                }
                <tr>
                  <td style="color: #a3a3a3; font-size: 14px; padding: 5px 0;">الشحن والتوصيل:</td>
                  <td style="color: #ffffff; font-size: 14px; padding: 5px 0; text-align: left; font-weight: 600;">${shippingFormatted}</td>
                </tr>
                <tr>
                  <td style="color: #ffffff; font-size: 18px; font-weight: 800; padding: 14px 0 6px; border-top: 1px solid #333333;">الإجمالي النهائي:</td>
                  <td style="color: #ffffff; font-size: 20px; font-weight: 900; padding: 14px 0 6px; text-align: left; border-top: 1px solid #333333;">${totalFormatted} ج.م</td>
                </tr>
                <tr>
                  <td style="color: #a3a3a3; font-size: 12px; padding: 2px 0;">إجمالي المدفوع اليوم:</td>
                  <td style="color: #22c55e; font-size: 12px; padding: 2px 0; text-align: left; font-weight: 600;">0.00 ج.م (دفع عند الاستلام)</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Customer & Shipping Info -->
          <tr>
            <td style="padding: 0 32px 32px;">
              <h2 style="color: #ffffff; font-size: 17px; font-weight: 700; border-bottom: 2px solid #e11d48; padding-bottom: 8px; margin: 0 0 16px;">
                معلومات العميل والشحن
              </h2>

              <div style="background-color: #1f1f1f; border-radius: 8px; padding: 18px; font-size: 14px; line-height: 1.8;">
                <div style="color: #ffffff;"><strong>الاسم:</strong> ${order.customer.name}</div>
                <div style="color: #d4d4d4;"><strong>الموبايل:</strong> <span dir="ltr">${order.customer.phone}</span></div>
                <div style="color: #d4d4d4;"><strong>المحافظة:</strong> ${order.customer.city}</div>
                <div style="color: #d4d4d4;"><strong>العنوان بالتفصيل:</strong> ${order.customer.address}</div>
                <div style="color: #d4d4d4; margin-top: 6px; padding-top: 6px; border-top: 1px dashed #333333;">
                  <strong>طريقة الدفع:</strong> الدفع نقداً عند الاستلام والمعاينة (COD)
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #121212; border-top: 1px solid #262626; text-align: center; color: #737373; font-size: 12px; line-height: 1.7;">
              إذا كانت لديك أي استفسارات، يمكنك الرد مباشرة على هذا البريد الإلكتروني.<br>
              <div style="margin-top: 12px;">
                <a href="${storeUrl}" style="color: #e5e5e5; text-decoration: underline; margin: 0 8px;">زيارة المتجر</a> · 
                <span style="color: #525252;">TERRA HOP © 2026 جميع الحقوق محفوظة</span>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const res = await sendBrevoEmail({
    to: order.customer.email,
    recipientName: order.customer.name,
    subject: `فاتورة وتأكيد الطلب #${order.number} | TERRA HOP`,
    html,
  });

  return res.ok;
}

/**
 * Send order accepted & delivery timeframe notification email to customer via Brevo.
 */
export async function sendOrderAcceptedEmail(
  order: {
    number: string;
    customer: {
      name: string;
      email: string;
      phone?: string;
      city?: string;
      address?: string;
    };
    totalCents: number;
  },
  deliveryDays: string = "من 2 إلى 4 أيام عمل"
): Promise<boolean> {
  if (!order.customer.email) return false;

  const totalFormatted = (order.totalCents / 100).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
  const storeUrl = APP_BASE_URL;

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تم قبول وتجهيز طلبك #${order.number}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0c0c0c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e5e5e5; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0c0c0c; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #171717; border-radius: 12px; border: 1px solid #262626; overflow: hidden; text-align: right;" cellpadding="0" cellspacing="0">
          
          <!-- Logo & Header -->
          <tr>
            <td style="padding: 36px 32px 24px; text-align: center; border-bottom: 1px solid #262626; background: linear-gradient(180deg, #1f1f1f 0%, #171717 100%);">
              <div style="font-size: 32px; font-weight: 900; letter-spacing: 4px; color: #ffffff; font-family: sans-serif;">TERRA HOP</div>
              <div style="font-size: 11px; letter-spacing: 3px; color: #e11d48; font-weight: 700; text-transform: uppercase; margin-top: 4px;">Streetwear Redefined</div>
            </td>
          </tr>

          <!-- Main Acceptance Content -->
          <tr>
            <td style="padding: 32px 32px 28px;">
              <div style="display: inline-block; background-color: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid #22c55e; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 700; margin-bottom: 14px;">
                ✓ تم قبول الطلب رسمياً وجاري الشحن
              </div>

              <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0 0 12px; line-height: 1.4;">
                خبر رائع، ${order.customer.name}! 🚀
              </h1>

              <p style="color: #d4d4d4; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
                يسعدنا إبلاغك بأن إدارة <strong>TERRA HOP</strong> قامت بقبول وتجهيز طلبك رقم <strong style="color: #ffffff; font-family: monospace;">#${order.number}</strong> للتوصيل.
              </p>

              <!-- Delivery Timeframe Highlight Box -->
              <div style="background: linear-gradient(135deg, #222222 0%, #1a1a1a 100%); border: 1px solid #333333; border-right: 4px solid #22c55e; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <div style="font-size: 13px; color: #a3a3a3; font-weight: 600; margin-bottom: 4px;">موعد التوصيل المتوقع:</div>
                <div style="font-size: 19px; color: #ffffff; font-weight: 800;">
                  هيوصل لك في غضون ${deliveryDays}
                </div>
                <div style="font-size: 13px; color: #a3a3a3; margin-top: 6px; line-height: 1.6;">
                  سيتواصل معك مندوب شركة الشحن هاتفياً أو عبر واتساب قبل الوصول لتسليم الشحنة.
                </div>
              </div>

              <!-- Payment Reminder Box -->
              <div style="background-color: #1f1f1f; border-radius: 8px; padding: 16px; font-size: 14px; line-height: 1.8; margin-bottom: 24px;">
                <div style="color: #a3a3a3;">المبلغ المطلوب سداده عند الاستلام:</div>
                <div style="color: #ffffff; font-size: 22px; font-weight: 900; margin: 4px 0;">${totalFormatted} ج.م</div>
                <div style="color: #a3a3a3; font-size: 12px;">الدفع نقداً بعد المعاينة عند باب بيتك.</div>
              </div>

              <!-- Store Link -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${storeUrl}" style="background-color: #ffffff; color: #000000; display: inline-block; padding: 14px 32px; border-radius: 6px; font-size: 15px; font-weight: 700; text-decoration: none; text-align: center;">
                      زيارة متجر TERRA HOP
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #121212; border-top: 1px solid #262626; text-align: center; color: #737373; font-size: 12px; line-height: 1.7;">
              شكراً لاختيارك TERRA HOP! 🖤<br>
              إذا كانت لديك أي استفسارات، يمكنك الرد مباشرة على هذا البريد الإلكتروني.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const res = await sendBrevoEmail({
    to: order.customer.email,
    recipientName: order.customer.name,
    subject: `تم قبول وتجهيز طلبك #${order.number} 🚀 | TERRA HOP`,
    html,
  });

  return res.ok;
}
