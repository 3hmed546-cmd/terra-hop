import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { getDb, recordAudit } from "@/lib/server/db";
import { getEmailConfig, sendMailUnified } from "@/lib/server/mailer";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  const config = getEmailConfig();
  return apiSuccess({
    webhookUrl: config.webhookUrl || "",
    brevoApiKey: config.brevoApiKey ? `${config.brevoApiKey.slice(0, 8)}...` : "",
    resendApiKey: config.resendApiKey ? `${config.resendApiKey.slice(0, 8)}...` : "",
    hasWebhook: Boolean(config.webhookUrl),
    hasBrevo: Boolean(config.brevoApiKey),
    hasResend: Boolean(config.resendApiKey),
    gmailUser: process.env.GMAIL_USER || "terr3hop@gmail.com",
  });
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات غير صالحة.", 400);
  }

  const db = getDb();
  const now = new Date().toISOString();
  const userEmail = auth.user.email;

  // If this is a test email request
  if (body.action === "TEST_EMAIL") {
    const to = String(body.to || userEmail || "terr3hop@gmail.com").trim();
    const ok = await sendMailUnified({
      to,
      subject: "تجربة إرسال الإيميل من متجر TERRA HOP 🖤",
      html: `
        <div dir="rtl" style="font-family: sans-serif; background-color: #0f0f0f; color: #f5f5f5; padding: 30px; border-radius: 12px; text-align: right;">
          <h1 style="color: #ffffff; font-size: 22px;">تم إرسال إيميل التجربة بنجاح! 🎉</h1>
          <p style="color: #cccccc; font-size: 15px; line-height: 1.6;">
            هذه الرسالة تؤكد أن نظام إرسال الإيميلات في متجر <strong>TERRA HOP</strong> يعمل بكفاءة ودون أي مشاكل في شبكة السيرفر.
          </p>
          <div style="background: #222; padding: 12px; border-radius: 8px; font-size: 13px; color: #888;">
            وقت الإرسال: ${new Date().toLocaleString("ar-EG")}
          </div>
        </div>
      `,
    });

    if (ok) {
      return apiSuccess({ ok: true, message: `تم إرسال الإيميل التجريبي بنجاح إلى ${to}` });
    } else {
      return apiError(
        "INTERNAL_ERROR",
        "فشل إرسال الإيميل التجريبي. تأكد من إعداد رابط Google Apps Script Webhook أو مفتاح Brevo بشكل صحيح.",
        500
      );
    }
  }

  // Otherwise, save settings
  const webhookUrl = body.webhookUrl !== undefined ? String(body.webhookUrl).trim() : null;
  const brevoApiKey = body.brevoApiKey !== undefined ? String(body.brevoApiKey).trim() : null;
  const resendApiKey = body.resendApiKey !== undefined ? String(body.resendApiKey).trim() : null;

  db.transaction(() => {
    if (webhookUrl !== null) {
      db.prepare(`
        INSERT INTO settings (group_key, key, value, updated_at, updated_by)
        VALUES ('email', 'webhook_url', ?, ?, ?)
        ON CONFLICT(group_key, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by
      `).run(webhookUrl, now, userEmail);
    }

    if (brevoApiKey !== null && !brevoApiKey.includes("...")) {
      db.prepare(`
        INSERT INTO settings (group_key, key, value, updated_at, updated_by)
        VALUES ('email', 'brevo_api_key', ?, ?, ?)
        ON CONFLICT(group_key, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by
      `).run(brevoApiKey, now, userEmail);
    }

    if (resendApiKey !== null && !resendApiKey.includes("...")) {
      db.prepare(`
        INSERT INTO settings (group_key, key, value, updated_at, updated_by)
        VALUES ('email', 'resend_api_key', ?, ?, ?)
        ON CONFLICT(group_key, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by
      `).run(resendApiKey, now, userEmail);
    }
  })();

  recordAudit({
    actor: userEmail,
    action: "UPDATE_EMAIL_SETTINGS",
    entity: "settings",
    entityId: "email",
    after: { hasWebhook: Boolean(webhookUrl), hasBrevo: Boolean(brevoApiKey) },
  });

  return apiSuccess({ ok: true, message: "تم حفظ إعدادات إرسال الإيميلات بنجاح." });
}
