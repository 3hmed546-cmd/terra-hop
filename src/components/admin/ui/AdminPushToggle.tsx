"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, BellOff, Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import {
  getCurrentPushSubscription,
  subscribeToAdminPush,
  unsubscribeFromAdminPush,
  sendTestAdminPush,
} from "@/lib/push-client";

export function AdminPushToggle({ compact = false }: { compact?: boolean }) {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      setSupported(false);
      return;
    }

    setPermission(Notification.permission);

    getCurrentPushSubscription()
      .then((sub) => {
        setSubscribed(!!sub);
      })
      .catch(() => {
        setSubscribed(false);
      });
  }, []);

  async function handleToggle() {
    setLoading(true);
    setErrorMsg(null);
    setTestStatus(null);

    if (subscribed) {
      await unsubscribeFromAdminPush();
      setSubscribed(false);
      setTestStatus("تم إلغاء تفعيل الإشعارات على هذا الجهاز.");
    } else {
      const res = await subscribeToAdminPush();
      if (res.success) {
        setSubscribed(true);
        setPermission(Notification.permission);
        setTestStatus("تم تفعيل الإشعارات بنجاح! سيصلك تنبيه عند كل طلب شراء جديد.");
      } else {
        setErrorMsg(res.error || "تعذر تفعيل الإشعارات.");
      }
    }

    setLoading(false);
  }

  async function handleTest() {
    setLoading(true);
    setErrorMsg(null);
    setTestStatus(null);

    const res = await sendTestAdminPush();
    if (res.success) {
      setTestStatus("تم إرسال إشعار تجريبي بنجاح! تحقق من شريط إشعارات جهازك الآن.");
    } else {
      setErrorMsg(res.error || "فشل إرسال الإشعار التجريبي.");
    }

    setLoading(false);
  }

  if (!supported) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs text-stone-600">
        هذا المتصفح لا يدعم تقنية Web Push Notifications.
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          disabled={loading}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            subscribed
              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              : "bg-stone-900 hover:bg-black text-white shadow-xs"
          } disabled:opacity-60`}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : subscribed ? (
            <BellRing className="w-3.5 h-3.5" />
          ) : (
            <Bell className="w-3.5 h-3.5" />
          )}
          <span>{subscribed ? "الإشعارات مفعلة" : "تفعيل الإشعارات"}</span>
        </button>

        {subscribed && (
          <button
            type="button"
            onClick={handleTest}
            disabled={loading}
            title="إرسال إشعار تجريبي"
            className="p-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-700 transition cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-stone-900/10 bg-white p-5 shadow-xs space-y-4 text-right" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              subscribed ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-700"
            }`}
          >
            {subscribed ? <BellRing className="w-5 h-5 animate-bounce" /> : <Bell className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-obsidian flex items-center gap-2">
              <span>إشعارات الطلبات الفورية (Push Notifications)</span>
              {subscribed ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  مفعلة على هذا المتصفح
                </span>
              ) : (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                  غير مفعلة
                </span>
              )}
            </h3>
            <p className="text-xs text-graphite mt-0.5">
              تصلك تنبيهات فورية بكل طلب شراء يؤكده العميل بصوت واهتزاز على جهازك حتى لو كان المتصفح أو المتجر مقفولاً.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {subscribed && (
            <button
              type="button"
              onClick={handleTest}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>إرسال إشعار تجريبي</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggle}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subscribed
                ? "border border-red-200 text-red-600 hover:bg-red-50"
                : "bg-obsidian hover:bg-charcoal text-white shadow-sm"
            } disabled:opacity-60`}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : subscribed ? (
              <BellOff className="w-3.5 h-3.5" />
            ) : (
              <BellRing className="w-3.5 h-3.5" />
            )}
            <span>{subscribed ? "إلغاء التفعيل" : "🔔 تفعيل الإشعارات على هذا الجهاز"}</span>
          </button>
        </div>
      </div>

      {permission === "denied" && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            تم حظر الإشعارات لهذا الموقع سابقاً في المتصفح. لتفعيلها، اضغط على علامة القفل 🔒 بجانب رابط الموقع في شريط العناوين واسمح بالإشعارات (Allow Notifications).
          </span>
        </div>
      )}

      {testStatus && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{testStatus}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
