"use client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.error("[Push] Failed to register service worker:", err);
    return null;
  }
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  const reg = await registerPushServiceWorker();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function subscribeToAdminPush(): Promise<{ success: boolean; error?: string }> {
  if (typeof window === "undefined" || !("Notification" in window) || !("PushManager" in window)) {
    return { success: false, error: "المتصفح الحالي لا يدعم إشعارات الويب الدفعية." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { success: false, error: "لم يتم منح إذن الإشعارات من المتصفح." };
  }

  const reg = await registerPushServiceWorker();
  if (!reg) {
    return { success: false, error: "فشل تهيئة مشغل الإشعارات (Service Worker)." };
  }

  // 1. Get VAPID public key from backend
  const res = await fetch("/api/admin/push");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { success: false, error: data?.error?.message || "فشل الحصول على مفتاح الإشعارات من السيرفر." };
  }

  const { data } = await res.json();
  const vapidPublicKey = data?.vapidPublicKey;
  if (!vapidPublicKey) {
    return { success: false, error: "مفتاح VAPID غير متوفر." };
  }

  // 2. Subscribe via PushManager
  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource,
      });
    }

    const subJson = sub.toJSON();

    // 3. Register subscription with backend
    const saveRes = await fetch("/api/admin/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subJson }),
    });

    if (!saveRes.ok) {
      const errData = await saveRes.json().catch(() => ({}));
      return { success: false, error: errData?.error?.message || "فشل تسجيل جهازك في قائمة الإشعارات." };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[Push] Subscription failed:", err);
    return { success: false, error: err.message || "حدث خطأ أثناء الاشتراك في الإشعارات." };
  }
}

export async function unsubscribeFromAdminPush(): Promise<{ success: boolean }> {
  try {
    const sub = await getCurrentPushSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await fetch("/api/admin/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
    }
    return { success: true };
  } catch (err) {
    console.error("[Push] Unsubscribe failed:", err);
    return { success: false };
  }
}

export async function sendTestAdminPush(): Promise<{ success: boolean; error?: string }> {
  try {
    const sub = await getCurrentPushSubscription();
    if (!sub) {
      return { success: false, error: "الجهاز غير مشترك في الإشعارات حالياً." };
    }

    const res = await fetch("/api/admin/push/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err?.error?.message || "فشل إرسال الإشعار التجريبي." };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "حدث خطأ أثناء إرسال الإشعار." };
  }
}
