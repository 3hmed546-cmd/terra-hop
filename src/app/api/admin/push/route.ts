import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import {
  getVapidPublicKey,
  saveAdminSubscription,
  deleteAdminSubscription,
  getAdminSubscriptionsCount,
  type PushSubscriptionData,
} from "@/lib/server/push";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated) return auth.responseError!;

  try {
    const vapidPublicKey = getVapidPublicKey();
    const count = getAdminSubscriptionsCount();
    return apiSuccess({ vapidPublicKey, subscriptionsCount: count });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", err.message || "Failed to get VAPID key", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated) return auth.responseError!;

  try {
    const body = await request.json();
    const subscription = body?.subscription as PushSubscriptionData;
    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return apiError("VALIDATION", "بيانات الاشتراك غير صالحة", 400);
    }

    const ua = request.headers.get("user-agent") || undefined;
    saveAdminSubscription(subscription, ua);

    return apiSuccess({ subscribed: true });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", err.message || "فشل حفظ الاشتراك", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated) return auth.responseError!;

  try {
    const body = await request.json();
    const endpoint = body?.endpoint;
    if (!endpoint) {
      return apiError("VALIDATION", "رابط الاشتراك مطلوب", 400);
    }

    deleteAdminSubscription(endpoint);
    return apiSuccess({ unsubscribed: true });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", err.message || "فشل إلغاء الاشتراك", 500);
  }
}
