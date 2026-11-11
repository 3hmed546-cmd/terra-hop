import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { getDb, recordAudit } from "@/lib/server/db";
import { getBrevoConfig, sendBrevoEmail, sendOrderInvoiceEmail } from "@/lib/server/mailer";

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
    const to = String(body.to || userEmail || "support@terra-hop.com").trim();
    const ok = await sendOrderInvoiceEmail({
      id: "test_order_" + Date.now(),
      number: "TH-1002",
      createdAt: now,
      customer: {
        name: "أحمد عبد الباسط",
        phone: "01285694670",
        email: to,
        city: "الجيزة",
        address: "شارع صابر عطية - مركز أوسيم",
      },
      items: [
        {
          name: "هودي عنابي أوفرسايز (Burgundy Oversized Hoodie)",
          color: "عنابي مارون",
          size: "XL",
          qty: 1,
          priceCents: 125000,
          imageUrl: "/products/burgundy-hoodie-model.jpg",
        },
      ],
      subtotalCents: 125000,
      shippingCents: 6000,
      discountCents: 0,
      totalCents: 131000,
    });

    if (ok) {
      return apiSuccess({ ok: true, message: `تم إرسال إيميل الفاتورة وتأكيد الطلب التجريبي بنجاح إلى ${to}` });
    } else {
      return apiError(
        "INTERNAL_ERROR",
        "فشل إرسال الإيميل التجريبي. تأكد من صحة مفتاح Brevo API Key وتفعيل الحساب.",
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
