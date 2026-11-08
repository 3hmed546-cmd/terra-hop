import crypto from "crypto";
import nodemailer from "nodemailer";
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
 * Fallback to Gmail SMTP via Nodemailer if Brevo fails or is unconfigured.
 */
async function sendGmailFallback({
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
  const user = process.env.GMAIL_USER || "terr3hop@gmail.com";
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.warn("[GMAIL_FALLBACK:SKIPPED] GMAIL_USER or GMAIL_APP_PASSWORD not set.");
    return { ok: false, error: "GMAIL_USER or GMAIL_APP_PASSWORD is not configured." };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from: `"TERRA HOP" <${user}>`,
      to: recipientName ? `"${recipientName}" <${to}>` : to,
      subject,
      html,
    });

    console.log(`[GMAIL_FALLBACK:SUCCESS] Sent email to ${to} via Gmail SMTP. MessageId: ${info.messageId}`);
    return { ok: true, messageId: info.messageId };
  } catch (err: any) {
    console.error(`[GMAIL_FALLBACK:ERROR] Failed to send email via Gmail SMTP:`, err);
    return { ok: false, error: err?.message || "Failed to send email via Gmail" };
  }
}

/**
 * Send email via Brevo REST API over HTTPS Port 443 with automatic Gmail fallback.
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
    console.warn(`[BREVO:WAITING_KEY] No Brevo API Key found. Falling back to Gmail SMTP...`);
    return sendGmailFallback({ to, subject, html, recipientName });
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
    console.warn(`[BREVO:FAILED] ${errDesc}. Falling back to Gmail SMTP...`);
    const fallbackRes = await sendGmailFallback({ to, subject, html, recipientName });
    if (fallbackRes.ok) return fallbackRes;
    return { ok: false, error: errDesc };
  } catch (err: any) {
    console.warn(`[BREVO:NETWORK_ERROR] ${err?.message}. Falling back to Gmail SMTP...`);
    const fallbackRes = await sendGmailFallback({ to, subject, html, recipientName });
    if (fallbackRes.ok) return fallbackRes;
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
    imageUrl?: string;
  }>;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
}

/**
 * Format cents to standard decimal string (e.g. 1,250.00)
 */
function formatEgp(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Resolve absolute product thumbnail image URL for email rendering.
 */
function getItemImageUrl(item: { name: string; color?: string; image?: string; imageUrl?: string }): string {
  let url = item.imageUrl || item.image;
  if (!url) {
    const text = `${item.name} ${item.color || ""}`.toLowerCase();
    if (text.includes("عنابي") || text.includes("burgundy")) url = "/products/burgundy-hoodie-model.jpg";
    else if (text.includes("أسود") || text.includes("black") || text.includes("obsidian")) url = "/products/black-hoodie-model.jpg";
    else if (text.includes("كريمي") || text.includes("cream") || text.includes("vintage")) url = "/products/cream-hoodie-model.jpg";
    else if (text.includes("زمردي") || text.includes("forest") || text.includes("emerald") || text.includes("أخضر")) url = "/products/forest-hoodie-model.jpg";
    else if (text.includes("موكا") || text.includes("brown") || text.includes("mocha") || text.includes("بني")) url = "/products/brown-hoodie-model.jpg";
    else if (text.includes("كحلي") || text.includes("navy")) url = "/products/navy-hoodie-model.jpg";
    else url = "/products/burgundy-hoodie-model.jpg";
  }
  return url.startsWith("http") ? url : `${APP_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * Send invoice and order confirmation request email to customer via Brevo.
 * Design is clean, Shopify/Testa-Toro styled, dark mode with white logo card and item images.
 */
export async function sendOrderInvoiceEmail(order: EmailOrderData): Promise<boolean> {
  if (!order.customer.email) return false;

  const confirmToken = generateOrderConfirmationToken(order.id, order.createdAt);
  const confirmUrl = `${APP_BASE_URL}/order/confirm?id=${encodeURIComponent(order.id)}&token=${encodeURIComponent(confirmToken)}`;
  const storeUrl = APP_BASE_URL;

  const subtotalFormatted = formatEgp(order.subtotalCents);
  const shippingFormatted =
    order.shippingCents === 0
      ? "مجاني"
      : `EGP ${formatEgp(order.shippingCents)}`;
  const discountFormatted =
    order.discountCents > 0
      ? formatEgp(order.discountCents)
      : null;
  const totalFormatted = formatEgp(order.totalCents);

  const itemsHtml = order.items
    .map((item) => {
      const priceFormatted = formatEgp(item.priceCents * item.qty);
      const imgUrl = getItemImageUrl(item);
      const variantDetails = [item.color, item.size].filter(Boolean).join(" / ");
      return `
        <tr>
          <!-- Product image thumbnail (Right in RTL) -->
          <td width="70" style="vertical-align: top; padding: 14px 0 14px 12px; width: 70px;">
            <img src="${imgUrl}" width="64" height="64" alt="${item.name}" style="display: block; width: 64px; height: 64px; object-fit: cover; border-radius: 6px; border: 1px solid #333333;" />
          </td>
          <!-- Title & Attributes (Middle in RTL) -->
          <td style="vertical-align: top; padding: 14px 8px; text-align: right;">
            <div style="font-weight: 600; color: #ffffff; font-size: 14px; line-height: 1.4; margin-bottom: 4px;">
              ${item.name}
            </div>
            <div style="color: #888888; font-size: 13px; margin-bottom: 2px;">
              × ${item.qty}
            </div>
            ${variantDetails ? `<div style="color: #888888; font-size: 12px;">${variantDetails}</div>` : ""}
          </td>
          <!-- Price (Left in RTL) -->
          <td style="vertical-align: top; padding: 14px 0; text-align: left; font-weight: 600; color: #ffffff; font-size: 14px; white-space: nowrap;" dir="ltr">
            EGP ${priceFormatted}
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
  <title>تم تأكيد الطلب #${order.number}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #121212; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #d4d4d4; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #121212; padding: 28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; text-align: right;" cellpadding="0" cellspacing="0">

          <!-- Centered Logo Card (Identical to Testa Toro) -->
          <tr>
            <td align="center" style="padding: 16px 0 28px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #ffffff; padding: 12px 20px; border-radius: 6px; text-align: center; border: 1px solid #ffffff;">
                    <img src="${storeUrl}/logo/terra-hop-logo-card.png" alt="TERRA HOP" width="130" style="display: block; width: 130px; height: auto;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Header & Order Confirmation Request -->
          <tr>
            <td style="padding: 0 4px 24px; direction: rtl; text-align: right;">
              <div style="color: #888888; font-size: 14px; margin-bottom: 8px; direction: rtl; text-align: right;">
                <span style="unicode-bidi: isolate;">طلب رقم:</span>&nbsp;<bdi dir="ltr" style="unicode-bidi: isolate; display: inline-block; font-family: Consolas, monospace; color: #ffffff; font-weight: 700;">#${order.number}</bdi>
              </div>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0 0 14px; line-height: 1.4; direction: rtl; text-align: right;">
                شكراً لطلبك من&nbsp;<bdi dir="ltr" style="unicode-bidi: isolate; display: inline-block; white-space: nowrap;">TERRA HOP</bdi>
              </h1>
              <p style="color: #a3a3a3; font-size: 14px; line-height: 1.7; margin: 0 0 22px; direction: rtl; text-align: right;">
                نحن نجهز قطعك ليتم شحنها. يرجى تأكيد رغبتك بالضغط على الزر أدناه لبدء الشحن فوراً.
              </p>

              <!-- Action Button ONLY (No raw links) -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
                <tr>
                  <td>
                    <a href="${confirmUrl}" style="background-color: #262626; color: #ffffff; display: inline-block; padding: 14px 28px; border-radius: 6px; font-size: 14px; font-weight: 700; text-decoration: none; border: 1px solid #404040; text-align: center;">
                      تأكيد طلبك
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Order Summary Section -->
          <tr>
            <td style="padding: 0 4px 12px; text-align: right;">
              <h2 style="color: #ffffff; font-size: 18px; font-weight: 700; margin: 0 0 16px;">
                ملخص الطلب
              </h2>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                ${itemsHtml}
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding: 16px 4px 28px; border-top: 1px solid #262626;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color: #888888; font-size: 14px; padding: 6px 0; text-align: right;">المجموع الفرعي</td>
                  <td style="color: #ffffff; font-size: 14px; padding: 6px 0; text-align: left;" dir="ltr">EGP ${subtotalFormatted}</td>
                </tr>
                ${
                  discountFormatted
                    ? `<tr>
                        <td style="color: #e11d48; font-size: 14px; padding: 6px 0; text-align: right;">الخصم</td>
                        <td style="color: #e11d48; font-size: 14px; padding: 6px 0; text-align: left;" dir="ltr">-EGP ${discountFormatted}</td>
                      </tr>`
                    : ""
                }
                <tr>
                  <td style="color: #888888; font-size: 14px; padding: 6px 0; text-align: right;">الشحن</td>
                  <td style="color: #ffffff; font-size: 14px; padding: 6px 0; text-align: left;" dir="ltr">${shippingFormatted}</td>
                </tr>
                <tr>
                  <td style="color: #888888; font-size: 14px; padding: 6px 0; text-align: right;">الضرائب</td>
                  <td style="color: #ffffff; font-size: 14px; padding: 6px 0; text-align: left;" dir="ltr">EGP 0.00</td>
                </tr>
                <tr>
                  <td style="color: #ffffff; font-size: 16px; font-weight: 700; padding: 18px 0 2px; text-align: right;">الإجمالي</td>
                  <td style="color: #ffffff; font-size: 22px; font-weight: 800; padding: 18px 0 2px; text-align: left;" dir="ltr">
                    EGP ${totalFormatted}<br>
                    <span style="font-size: 11px; color: #888888; font-weight: normal;">EGP</span>
                  </td>
                </tr>
                <tr>
                  <td style="color: #888888; font-size: 13px; padding: 6px 0; text-align: right;">إجمالي المدفوع اليوم</td>
                  <td style="color: #ffffff; font-size: 13px; padding: 6px 0; text-align: left;" dir="ltr">EGP 0.00 EGP</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Customer Info -->
          <tr>
            <td style="padding: 20px 4px 28px; border-top: 1px solid #262626; text-align: right;">
              <h2 style="color: #ffffff; font-size: 18px; font-weight: 700; margin: 0 0 18px;">
                معلومات العميل
              </h2>

              <div style="margin-bottom: 22px;">
                <div style="color: #888888; font-size: 13px; margin-bottom: 4px;">عنوان الشحن</div>
                <div style="color: #ffffff; font-size: 14px; font-weight: 700; line-height: 1.5;"><bdi dir="auto" style="unicode-bidi: isolate;">${order.customer.name}</bdi></div>
                <div style="color: #a3a3a3; font-size: 14px; line-height: 1.6;">${order.customer.address}</div>
                <div style="color: #a3a3a3; font-size: 14px; line-height: 1.6;">${order.customer.city}</div>
                <div style="color: #a3a3a3; font-size: 14px; line-height: 1.6;">مصر</div>
                <div style="color: #a3a3a3; font-size: 14px; line-height: 1.6;" dir="ltr">${order.customer.phone}</div>
              </div>

              <div style="margin-bottom: 22px;">
                <div style="color: #888888; font-size: 13px; margin-bottom: 4px;">عنوان الفوترة</div>
                <div style="color: #a3a3a3; font-size: 14px; line-height: 1.6;">مطابق لعنوان الشحن</div>
              </div>

              <div style="margin-bottom: 22px;">
                <div style="color: #888888; font-size: 13px; margin-bottom: 4px;">الدفع</div>
                <div style="color: #ffffff; font-size: 14px;">الدفع عند الاستلام (COD)</div>
              </div>

              <div>
                <div style="color: #888888; font-size: 13px; margin-bottom: 4px;">طريقة الشحن</div>
                <div style="color: #ffffff; font-size: 14px; line-height: 1.6;">شحن سريع ومعاينة وقياس قبل الاستلام</div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 4px 12px; border-top: 1px solid #262626; text-align: center; color: #737373; font-size: 12px; line-height: 1.7; direction: rtl;">
              <span dir="ltr" style="unicode-bidi: isolate; display: inline-block;">TERRA HOP · Streetwear Redefined © 2026</span><br>
              <span dir="ltr" style="color: #a3a3a3; unicode-bidi: isolate; display: inline-block;">terr3hop@gmail.com</span>
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
    subject: `فاتورة وتأكيد طلبك رقم ${order.number} | TERRA HOP`,
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

  const totalFormatted = formatEgp(order.totalCents);
  const storeUrl = APP_BASE_URL;

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تم قبول وشحن طلبك #${order.number}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #121212; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #d4d4d4; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #121212; padding: 28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; text-align: right;" cellpadding="0" cellspacing="0">

          <!-- Centered Logo Card -->
          <tr>
            <td align="center" style="padding: 16px 0 28px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #ffffff; padding: 12px 20px; border-radius: 6px; text-align: center; border: 1px solid #ffffff;">
                    <img src="${storeUrl}/logo/terra-hop-logo-card.png" alt="TERRA HOP" width="130" style="display: block; width: 130px; height: auto;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Acceptance Content -->
          <tr>
            <td style="padding: 0 4px 24px; direction: rtl; text-align: right;">
              <div style="color: #888888; font-size: 14px; margin-bottom: 8px; direction: rtl; text-align: right;">
                <span style="unicode-bidi: isolate;">طلب رقم:</span>&nbsp;<bdi dir="ltr" style="unicode-bidi: isolate; display: inline-block; font-family: Consolas, monospace; color: #ffffff; font-weight: 700;">#${order.number}</bdi>
              </div>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0 0 14px; line-height: 1.4; direction: rtl; text-align: right;">
                تم قبول وتجهيز طلبك
              </h1>
              <p style="color: #d4d4d4; font-size: 14px; line-height: 1.8; margin: 0 0 22px; direction: rtl; text-align: right;">
                <span>مرحباً</span>&nbsp;<strong style="color: #ffffff;"><bdi dir="auto" style="unicode-bidi: isolate; display: inline-block;">${order.customer.name}</bdi></strong>،<br>
                <span style="color: #a3a3a3;">يسعدنا إبلاغك بأن طلبك رقم&nbsp;<bdi dir="ltr" style="unicode-bidi: isolate; font-weight: 700; color: #ffffff;">#${order.number}</bdi>&nbsp;تم تأكيده وتجهيزه للتسليم لشركة الشحن.</span>
              </p>

              <!-- Delivery Timeframe -->
              <div style="background-color: #1a1a1a; border: 1px solid #2e2e2e; border-right: 4px solid #22c55e; border-radius: 6px; padding: 18px; margin-bottom: 22px; direction: rtl; text-align: right;">
                <div style="font-size: 13px; color: #888888; font-weight: 600; margin-bottom: 4px;">موعد التوصيل المتوقع</div>
                <div style="font-size: 18px; color: #ffffff; font-weight: 800;">
                  <bdi dir="auto" style="unicode-bidi: isolate;">${deliveryDays}</bdi>
                </div>
                <div style="font-size: 13px; color: #a3a3a3; margin-top: 6px; line-height: 1.6;">
                  سيتواصل معك مندوب شركة الشحن هاتفياً قبل الوصول لتسليم الشحنة.
                </div>
              </div>

              <!-- Payment Box -->
              <div style="background-color: #1a1a1a; border: 1px solid #2e2e2e; border-radius: 6px; padding: 18px; margin-bottom: 22px; direction: rtl; text-align: right;">
                <div style="color: #888888; font-size: 13px;">المبلغ المطلوب عند الاستلام:</div>
                <div style="color: #ffffff; font-size: 20px; font-weight: 800; margin: 4px 0;" dir="ltr">EGP ${totalFormatted}</div>
                <div style="color: #a3a3a3; font-size: 12px;">الدفع نقداً بعد المعاينة والقياس.</div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 4px 12px; border-top: 1px solid #262626; text-align: center; color: #737373; font-size: 12px; line-height: 1.7; direction: rtl;">
              <span dir="ltr" style="unicode-bidi: isolate; display: inline-block;">TERRA HOP · Streetwear Redefined © 2026</span><br>
              <span dir="ltr" style="color: #a3a3a3; unicode-bidi: isolate; display: inline-block;">terr3hop@gmail.com</span>
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
    subject: `تم قبول وشحن طلبك رقم ${order.number} | TERRA HOP`,
    html,
  });

  return res.ok;
}

/**
 * Send polite order rejected / cancelled notification email to customer via Brevo.
 */
export async function sendOrderRejectedEmail(
  order: {
    number: string;
    customer: {
      name: string;
      email: string;
    };
  },
  reason: string = "تعذر تأكيد أو شحن الطلب في الوقت الحالي"
): Promise<boolean> {
  if (!order.customer.email) return false;

  const storeUrl = APP_BASE_URL;

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تحديث بخصوص طلبك #${order.number}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #121212; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #d4d4d4; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #121212; padding: 28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; text-align: right;" cellpadding="0" cellspacing="0">

          <!-- Centered Logo Card -->
          <tr>
            <td align="center" style="padding: 16px 0 28px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #ffffff; padding: 12px 20px; border-radius: 6px; text-align: center; border: 1px solid #ffffff;">
                    <img src="${storeUrl}/logo/terra-hop-logo-card.png" alt="TERRA HOP" width="130" style="display: block; width: 130px; height: auto;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rejection Content -->
          <tr>
            <td style="padding: 0 4px 24px; direction: rtl; text-align: right;">
              <div style="color: #888888; font-size: 14px; margin-bottom: 8px; direction: rtl; text-align: right;">
                <span style="unicode-bidi: isolate;">طلب رقم:</span>&nbsp;<bdi dir="ltr" style="unicode-bidi: isolate; display: inline-block; font-family: Consolas, monospace; color: #ffffff; font-weight: 700;">#${order.number}</bdi>
              </div>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0 0 14px; line-height: 1.4; direction: rtl; text-align: right;">
                نعتذر منك&nbsp;<bdi dir="auto" style="unicode-bidi: isolate; display: inline-block;">${order.customer.name}</bdi>
              </h1>
              <p style="color: #d4d4d4; font-size: 14px; line-height: 1.8; margin: 0 0 22px; direction: rtl; text-align: right;">
                <span style="color: #a3a3a3;">نأسف لإبلاغك بأنه تعذر استكمال وتجهيز طلبك رقم&nbsp;<bdi dir="ltr" style="unicode-bidi: isolate; font-weight: 700; color: #ffffff;">#${order.number}</bdi>&nbsp;وتم إلغاؤه من قِبل إدارة المتجر.</span>
              </p>

              <!-- Reason Box -->
              <div style="background-color: #1a1a1a; border: 1px solid #2e2e2e; border-right: 4px solid #e11d48; border-radius: 6px; padding: 18px; margin-bottom: 22px; direction: rtl; text-align: right;">
                <div style="font-size: 13px; color: #888888; font-weight: 600; margin-bottom: 4px;">سبب الإلغاء</div>
                <div style="font-size: 15px; color: #ffffff; font-weight: 600; line-height: 1.6;">
                  <bdi dir="auto" style="unicode-bidi: isolate;">${reason}</bdi>
                </div>
              </div>

              <p style="color: #888888; font-size: 13px; line-height: 1.7; margin: 0; direction: rtl; text-align: right;">
                نعتذر بشدة عن أي إزعاج قد سببه ذلك لك، ويسعدنا دائماً زيارتك للمتجر مرة أخرى لاختيار أي قطع بديلة.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 4px 12px; border-top: 1px solid #262626; text-align: center; color: #737373; font-size: 12px; line-height: 1.7; direction: rtl;">
              <span dir="ltr" style="unicode-bidi: isolate; display: inline-block;">TERRA HOP · Streetwear Redefined © 2026</span><br>
              <span dir="ltr" style="color: #a3a3a3; unicode-bidi: isolate; display: inline-block;">terr3hop@gmail.com</span>
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
    subject: `تحديث بخصوص طلبك رقم ${order.number} | TERRA HOP`,
    html,
  });

  return res.ok;
}

/**
 * Send Order Delivered & Thank-You email with VIP WhatsApp Community button.
 * Zero emojis, clean dark Testa Toro luxury branding.
 */
export async function sendOrderDeliveredThankYouEmail(order: {
  number: string;
  customer: {
    name: string;
    email: string;
  };
}): Promise<boolean> {
  if (!order.customer.email) return false;

  const storeUrl = APP_BASE_URL;
  const whatsappUrl = "https://chat.whatsapp.com/EWcBrybFmbr7jbMJUJGSUk?s=cl&p=a&iam=2";

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تم تسليم طلبك #${order.number} | TERRA HOP</title>
</head>
<body style="margin: 0; padding: 0; background-color: #121212; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #d4d4d4; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #121212; padding: 28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; text-align: right;" cellpadding="0" cellspacing="0">

          <!-- Centered Logo Card -->
          <tr>
            <td align="center" style="padding: 16px 0 28px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #ffffff; padding: 12px 20px; border-radius: 6px; text-align: center; border: 1px solid #ffffff;">
                    <img src="${storeUrl}/logo/terra-hop-logo-card.png" alt="TERRA HOP" width="130" style="display: block; width: 130px; height: auto;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Thank You & Delivered Content -->
          <tr>
            <td style="padding: 0 4px 24px; direction: rtl; text-align: right;">
              <div style="color: #888888; font-size: 14px; margin-bottom: 8px; direction: rtl; text-align: right;">
                <span style="unicode-bidi: isolate;">طلب رقم:</span>&nbsp;<bdi dir="ltr" style="unicode-bidi: isolate; display: inline-block; font-family: Consolas, monospace; color: #ffffff; font-weight: 700;">#${order.number}</bdi>
              </div>

              <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0 0 14px; line-height: 1.4; direction: rtl; text-align: right;">
                شكراً لتعاملك مع&nbsp;<bdi dir="ltr" style="unicode-bidi: isolate; display: inline-block; white-space: nowrap;">TERRA HOP</bdi>
              </h1>

              <p style="color: #d4d4d4; font-size: 14px; line-height: 1.8; margin: 0 0 22px; direction: rtl; text-align: right;">
                <span>مرحباً</span>&nbsp;<strong style="color: #ffffff;"><bdi dir="auto" style="unicode-bidi: isolate; display: inline-block;">${order.customer.name}</bdi></strong>،<br>
                <span style="color: #a3a3a3;">يسعدنا إبلاغك بأنه تم تسليم طلبك بنجاح. نتمنى أن تنال القطع إعجابك وتناسب ستايلك المميز.</span>
              </p>

              <!-- Delivery Confirmed Box -->
              <div style="background-color: #1a1a1a; border: 1px solid #2e2e2e; border-right: 4px solid #22c55e; border-radius: 6px; padding: 16px; margin-bottom: 24px; direction: rtl; text-align: right;">
                <div style="font-size: 13px; color: #888888; font-weight: 600; margin-bottom: 4px;">حالة الطلب</div>
                <div style="font-size: 16px; color: #ffffff; font-weight: 700;">
                  تم التسليم واستلام المبلغ بنجاح
                </div>
              </div>

              <!-- VIP WhatsApp Community Card -->
              <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 24px 20px; text-align: center; margin-bottom: 24px; direction: rtl;">
                <div style="color: #ffffff; font-size: 17px; font-weight: 800; margin-bottom: 8px; direction: rtl; text-align: center;">
                  انضم إلى مجتمع&nbsp;<bdi dir="ltr" style="unicode-bidi: isolate; display: inline-block; white-space: nowrap;">TERRA HOP VIP</bdi>
                </div>
                <p style="color: #a1a1aa; font-size: 13px; line-height: 1.7; margin: 0 auto 20px; max-width: 420px; direction: rtl; text-align: center;">
                  انضم لجروب الواتساب الخاص بعملائنا المميزين للحصول على أكواد خصم حصرية وإشعارات مبكرة بأحدث الكولكشنز والقطع المحدودة.
                </p>
                <a href="${whatsappUrl}" style="display: inline-block; background-color: #22c55e; color: #ffffff; padding: 13px 44px; border-radius: 6px; font-weight: 800; font-size: 15px; text-decoration: none; text-align: center; box-shadow: 0 2px 10px rgba(34, 197, 94, 0.35);">
                  انضم الآن
                </a>
              </div>

              <p style="color: #737373; font-size: 13px; line-height: 1.6; margin: 0; direction: rtl; text-align: right;">
                إذا كانت لديك أي استفسارات أو ملاحظات، يمكنك دائماً الرد على هذا البريد الإلكتروني.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 4px 12px; border-top: 1px solid #262626; text-align: center; color: #737373; font-size: 12px; line-height: 1.7; direction: rtl;">
              <span dir="ltr" style="unicode-bidi: isolate; display: inline-block;">TERRA HOP · Streetwear Redefined © 2026</span><br>
              <span dir="ltr" style="color: #a3a3a3; unicode-bidi: isolate; display: inline-block;">terr3hop@gmail.com</span>
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
    subject: `تم تسليم طلبك رقم ${order.number} | شكراً لتعاملك مع TERRA HOP`,
    html,
  });

  return res.ok;
}
