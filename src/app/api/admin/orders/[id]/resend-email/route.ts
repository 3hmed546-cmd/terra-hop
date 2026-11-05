import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb } from "@/lib/server/db";
import { decryptCustomer } from "@/lib/server/vault";
import { sendOrderInvoiceEmail } from "@/lib/server/mailer";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth.authenticated) return auth.responseError!;

  const { id } = await context.params;
  const db = getDb();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as any;

  if (!order) {
    return apiError("NOT_FOUND", "الطلب غير موجود.", 404);
  }

  let customer: any;
  try {
    customer = decryptCustomer(order.customer_enc);
  } catch {
    return apiError("INTERNAL_ERROR", "فشل فك تشفير بيانات العميل.", 500);
  }

  if (!customer?.email) {
    return apiError("VALIDATION", "لا يوجد بريد إلكتروني مسجل لهذا الطلب.", 400);
  }

  const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(id) as any[];

  const ok = await sendOrderInvoiceEmail({
    id: order.id,
    number: order.number,
    createdAt: order.created_at,
    customer: {
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      city: customer.city,
      address: customer.address,
    },
    items: items.map((it) => ({
      name: it.product_name,
      color: it.color_name,
      size: it.size,
      qty: it.qty,
      priceCents: it.price_cents_snapshot,
    })),
    subtotalCents: order.subtotal_cents,
    shippingCents: order.shipping_cents,
    discountCents: order.discount_cents,
    totalCents: order.total_cents,
  });

  if (!ok) {
    return apiError("INTERNAL_ERROR", "فشل إرسال البريد الإلكتروني. يرجى التحقق من إعدادات SMTP.", 500);
  }

  return apiSuccess({ message: `تم إعادة إرسال الفاتورة ورابط التأكيد إلى ${customer.email} بنجاح.` });
}
