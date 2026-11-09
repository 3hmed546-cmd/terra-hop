import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb } from "@/lib/server/db";
import { decryptCustomer } from "@/lib/server/vault";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { markOrderDeliveredAndPaid } from "@/lib/server/ambassadors/qualification";
import { sendOrderDeliveredThankYouEmail } from "@/lib/server/mailer";
import { sendOrderDeliveredWhatsAppNotification } from "@/lib/server/services/whatsapp-bot";
import { saveConfirmedCustomer } from "@/lib/server/confirmed-customers";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  const { id } = await context.params;
  const db = getDb();

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // optional body
  }

  try {
    const result = markOrderDeliveredAndPaid(
      db,
      id,
      auth.user.email,
      body.courierReference
    );

    // Save customer to the encrypted confirmed_customers vault
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(result.orderId) as any;
    if (order) {
      try {
        saveConfirmedCustomer(db, order);
      } catch (custErr) {
        console.error("[ConfirmedCustomers:mark-delivered] Save failed:", custErr);
      }
    }

    // Send Order Delivered & Thank You Email & WhatsApp message
    try {
      if (order?.customer_enc) {
        const cust = decryptCustomer(Buffer.from(order.customer_enc));
        if (cust?.email) {
          sendOrderDeliveredThankYouEmail({
            number: order.number,
            customer: cust,
          }).catch((err) => {
            console.error("[Mailer] Failed to send thank you email on delivered-paid:", err);
          });
        }

        sendOrderDeliveredWhatsAppNotification({
          orderNumber: order.number,
          customerName: cust?.name || "عميلنا العزيز",
          customerPhone: order.customer_phone || cust?.phone || "",
        }).catch((waErr) => {
          console.error("[WhatsApp] Delivered thank-you notification failed:", waErr);
        });
      }
    } catch (e) {
      console.error("[Mailer] Customer decrypt failed for thank you email on delivered-paid:", e);
    }

    return apiSuccess(result);
  } catch (err: any) {
    return apiError("VALIDATION", err.message || "فشل تأكيد التسليم والتحصيل.", 400);
  }
}
