"use client";

import { useEffect, useState } from "react";
import { Clock, Eye, Sparkles, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useLive } from "@/lib/use-live";
import { apiFetch } from "@/lib/admin-auth";

export function ComingSoonSection() {
  const { data: liveSite } = useLive("settings");
  const [enabled, setEnabled] = useState(false);
  const [targetDate, setTargetDate] = useState("2026-11-20T00:00");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Sync with live database setting
  useEffect(() => {
    const cs = liveSite?.settings?.store?.coming_soon;
    if (cs) {
      setEnabled(Boolean(cs.enabled));
      if (cs.targetDate) {
        // Format ISO string to datetime-local format (YYYY-MM-DDTHH:mm)
        try {
          const d = new Date(cs.targetDate);
          if (!isNaN(d.getTime())) {
            const pad = (n: number) => String(n).padStart(2, "0");
            const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            setTargetDate(localStr);
          } else {
            setTargetDate(cs.targetDate.slice(0, 16));
          }
        } catch {
          setTargetDate("2026-11-20T00:00");
        }
      }
    }
  }, [liveSite]);

  async function updateSetting(newEnabled: boolean, newDate: string) {
    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await apiFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupKey: "store",
          key: "coming_soon",
          value: {
            enabled: newEnabled,
            targetDate: newDate ? new Date(newDate).toISOString() : "2026-11-20T00:00:00.000Z",
            title: "TERRA HOP IS COMING SOON",
            updatedAt: new Date().toISOString(),
          },
        }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok || !payload.ok) {
        throw new Error(payload?.error?.message || payload?.error || "فشل حفظ الإعدادات، يرجى المحاولة مرة أخرى.");
      }

      setEnabled(newEnabled);
      setStatusMessage({
        type: "success",
        text: newEnabled
          ? "تم تفعيل وضع Coming Soon بنجاح! الموقع يعرض الآن شاشة الإطلاق والعداد."
          : "تم إلغاء وضع Coming Soon بنجاح! الموقع عاد للعمل بشكل طبيعي لجميع الزوار.",
      });
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err?.message || "حدث خطأ أثناء حفظ الإعدادات.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle() {
    await updateSetting(!enabled, targetDate);
  }

  async function handleSaveDate(e: React.FormEvent) {
    e.preventDefault();
    await updateSetting(enabled, targetDate);
  }

  return (
    <div className="space-y-6 pt-2">
      {/* Status banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
          enabled
            ? "bg-amber-950/20 border-amber-500/40 text-amber-200"
            : "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full animate-ping ${
              enabled ? "bg-amber-400" : "bg-emerald-400"
            }`}
          />
          <div>
            <h3 className="font-bold text-base text-off-white">
              {enabled ? "وضع Coming Soon (قيد التشغيل)" : "المتجر في الوضع الطبيعي (متاح للجميع)"}
            </h3>
            <p className="text-xs opacity-80 mt-0.5">
              {enabled
                ? "الموقع يعرض صورة الإطلاق فقط والعداد التنازلي لجميع الزوار، مع إخفاء المنتجات وبقاء الفوتر."
                : "جميع المنتجات وصفحات المتجر تعمل وتستقبل الزوار والطلبات بشكل كامل."}
            </p>
          </div>
        </div>

        {/* Toggle Button */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={loading}
          aria-label="تبديل وضع Coming Soon"
          className={`relative inline-flex h-9 w-20 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            enabled ? "bg-amber-500" : "bg-zinc-700"
          } ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <span
            className={`pointer-events-none inline-block h-8 w-8 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
              enabled ? "translate-x-11" : "translate-x-0"
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 text-zinc-800 animate-spin" />
            ) : enabled ? (
              <Sparkles className="w-4 h-4 text-amber-600" />
            ) : (
              <Clock className="w-4 h-4 text-zinc-500" />
            )}
          </span>
        </button>
      </div>

      {/* Target Date Configuration Form */}
      <form onSubmit={handleSaveDate} className="bg-white/[0.02] border border-white/10 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <label htmlFor="target-date-input" className="block text-sm font-semibold text-off-white">
              موعد الإطلاق المستهدف (نهاية العداد التنازلي)
            </label>
            <p className="text-xs text-concrete mt-0.5">
              حدد اليوم والساعة التي سينتهي عندها العداد (الافتراضي: 20 نوفمبر 2026).
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <input
            id="target-date-input"
            type="datetime-local"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            disabled={loading}
            className="flex-1 bg-obsidian border border-white/20 rounded-lg px-3.5 py-2 text-off-white text-sm focus:outline-none focus:border-white transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-off-white text-obsidian font-bold text-sm hover:bg-white transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
            حفظ الموعد
          </button>
        </div>
      </form>

      {/* Status feedback message */}
      {statusMessage && (
        <div
          className={`p-3 rounded-lg flex items-center gap-2.5 text-xs ${
            statusMessage.type === "success"
              ? "bg-emerald-950/40 border border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/40 border border-rose-500/30 text-rose-300"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Info and Preview Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-white/5">
        <p className="text-xs text-concrete leading-relaxed max-w-xl">
          💡 عند التفعيل، ستتغير واجهة الموقع كلياً في نفس اللحظة عبر البث المباشر (SSE)، وتظهر صورة الإطلاق مع العداد التنازلي، ويبقى الفوتر متاحاً أسفل الصفحة بالمعلومات وروابط التواصل. لوحة تحكم الإدارة تظل متاحة لك دائماً.
        </p>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/20 text-xs font-semibold text-off-white hover:bg-white/5 transition-colors shrink-0"
        >
          <Eye className="w-3.5 h-3.5" />
          معاينة الواجهة كزائر ↗
        </a>
      </div>
    </div>
  );
}
