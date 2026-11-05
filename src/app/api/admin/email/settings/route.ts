import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { getDb, recordAudit } from "@/lib/server/db";
import { getBrevoConfig, sendBrevoEmail } from "@/lib/server/mailer";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  const config = getBrevoConfig();
  return apiSuccess({
    brevoApiKey: config.apiKey ? `${config.apiKey.slice(0, 10)}...` : "",
    hasBrevo: Boolean(config.apiKey),
    senderEmail: config.senderEmail,
    senderName: config.senderName,
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
    const result = await sendBrevoEmail({
      to,
      subject: "تجربة إرسال الإيميل من متجر TERRA HOP عبر Brevo 🖤",
      html: `
        <div dir="rtl" style="font-family: sans-serif; background-color: #0f0f0f; color: #f5f5f5; padding: 30px; border-radius: 12px; text-align: right;">
          <h1 style="color: #ffffff; font-size: 22px;">تم إرسال إيميل التجربة عبر Brevo بنجاح! 🎉</h1>
          <p style="color: #cccccc; font-size: 15px; line-height: 1.6;">
            هذه الرسالة تؤكد أن ربط <strong>Brevo API</strong> مع متجر <strong>TERRA HOP</strong> يعمل بكفاءة 100%، وأن فواتير وإشعارات تأكيد الطلبات ستصل لعملائك فوراً.
          </p>
          <div style="background: #222; padding: 12px; border-radius: 8px; font-size: 13px; color: #888;">
            وقت الإرسال: ${new Date().toLocaleString("ar-EG")}
          </div>
        </div>
      `,
    });

    if (result.ok) {
      return apiSuccess({ ok: true, message: `تم إرسال الإيميل التجريبي بنجاح إلى ${to}` });
    } else {
      return apiError(
        "INTERNAL_ERROR",
        result.error || "فشل إرسال الإيميل التجريبي. تأكد من صحة مفتاح Brevo API Key وتفعيل الحساب.",
        500
      );
    }
  }

  // Otherwise, save settings
  const brevoApiKey = body.brevoApiKey !== undefined ? String(body.brevoApiKey).trim() : null;
  const senderEmail = body.senderEmail !== undefined ? String(body.senderEmail).trim() : null;

  db.transaction(() => {
    if (brevoApiKey !== null && !brevoApiKey.includes("...")) {
      db.prepare(`
        INSERT INTO settings (group_key, key, value, updated_at, updated_by)
        VALUES ('email', 'brevo_api_key', ?, ?, ?)
        ON CONFLICT(group_key, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by
      `).run(brevoApiKey, now, userEmail);
    }

    if (senderEmail !== null && senderEmail.length > 3) {
      db.prepare(`
        INSERT INTO settings (group_key, key, value, updated_at, updated_by)
        VALUES ('email', 'sender_email', ?, ?, ?)
        ON CONFLICT(group_key, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by
      `).run(senderEmail, now, userEmail);
    }
  })();

  recordAudit({
    actor: userEmail,
    action: "UPDATE_BREVO_SETTINGS",
    entity: "settings",
    entityId: "email",
    after: { hasBrevo: Boolean(brevoApiKey) },
  });

  return apiSuccess({ ok: true, message: "تم حفظ إعدادات Brevo بنجاح." });
}
