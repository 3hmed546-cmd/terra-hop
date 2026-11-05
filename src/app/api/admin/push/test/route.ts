import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { sendTestNotification, type PushSubscriptionData } from "@/lib/server/push";

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated) return auth.responseError!;

  try {
    const body = await request.json();
    const subscription = body?.subscription as PushSubscriptionData;
    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return apiError("VALIDATION", "بيانات الاشتراك غير صالحة للاختبار", 400);
    }

    await sendTestNotification(subscription);
    return apiSuccess({ sent: true });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", err.message || "فشل إرسال الإشعار التجريبي", 500);
  }
}
