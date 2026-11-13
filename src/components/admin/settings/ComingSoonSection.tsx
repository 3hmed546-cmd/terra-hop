"use client";

import { useEffect, useRef, useState } from "react";
import {
  Clock,
  Eye,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  Image as ImageIcon,
  RotateCcw,
  Type,
} from "lucide-react";
import { useLive } from "@/lib/use-live";
import { apiFetch } from "@/lib/admin-auth";

const DEFAULT_IMAGE_URL = "/coming-soon.jpg";

export function ComingSoonSection() {
  const { data: liveSite } = useLive("settings");
  const [enabled, setEnabled] = useState(false);
  const [targetDate, setTargetDate] = useState("2026-11-20T00:00");
  const [imageUrl, setImageUrl] = useState(DEFAULT_IMAGE_URL);
  const [caption, setCaption] = useState("");

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync with live database setting
  useEffect(() => {
    const cs = liveSite?.settings?.store?.coming_soon;
    if (cs) {
      setEnabled(Boolean(cs.enabled));
      if (cs.imageUrl) {
        setImageUrl(cs.imageUrl);
      }
      if (cs.caption !== undefined) {
        setCaption(cs.caption);
      }
      if (cs.targetDate) {
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

  async function handleSaveSettings(
    override?: { newEnabled?: boolean; newDate?: string; newImage?: string; newCaption?: string }
  ) {
    setLoading(true);
    setStatusMessage(null);

    const saveEnabled = override?.newEnabled !== undefined ? override.newEnabled : enabled;
    const saveDate = override?.newDate !== undefined ? override.newDate : targetDate;
    const saveImage = override?.newImage !== undefined ? override.newImage : imageUrl;
    const saveCaption = override?.newCaption !== undefined ? override.newCaption : caption;

    try {
      const res = await apiFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupKey: "store",
          key: "coming_soon",
          value: {
            enabled: saveEnabled,
            targetDate: saveDate ? new Date(saveDate).toISOString() : "2026-11-20T00:00:00.000Z",
            title: "TERRA HOP IS COMING SOON",
            imageUrl: saveImage || DEFAULT_IMAGE_URL,
            caption: saveCaption.trim(),
            updatedAt: new Date().toISOString(),
          },
        }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok || !payload.ok) {
        throw new Error(payload?.error?.message || payload?.error || "فشل حفظ الإعدادات، يرجى المحاولة مرة أخرى.");
      }

      setEnabled(saveEnabled);
      setImageUrl(saveImage);
      setCaption(saveCaption);

      setStatusMessage({
        type: "success",
        text: "تم حفظ إعدادات Coming Soon بنجاح! التغييرات تظهر لحظياً لجميع الزوار.",
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
    const nextState = !enabled;
    setEnabled(nextState);
    await handleSaveSettings({ newEnabled: nextState });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiFetch("/api/admin/assets", {
        method: "POST",
        body: formData,
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.ok || !payload.data?.url) {
        throw new Error(payload?.error?.message || payload?.error || "فشل رفع الصورة.");
      }

      const uploadedUrl = payload.data.url;
      setImageUrl(uploadedUrl);
      setStatusMessage({
        type: "success",
        text: "تم رفع الصورة بنجاح! اضغط 'حفظ جميع التغييرات' لاعتمادها على الموقع.",
      });
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err?.message || "حدث خطأ أثناء رفع الصورة.",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleResetImage() {
    setImageUrl(DEFAULT_IMAGE_URL);
    setStatusMessage({
      type: "success",
      text: "تم استعادة مسار الصورة الافتراضية. اضغط 'حفظ جميع التغييرات' للتأكيد.",
    });
  }

  return (
    <div className="space-y-6 pt-2">
      {/* 1. Status Banner with Instant Live Toggle */}
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

      {/* 2. Target Date Picker */}
      <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 sm:p-5 space-y-3">
        <div>
          <label htmlFor="target-date-input" className="block text-sm font-semibold text-off-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-concrete" />
            موعد الإطلاق المستهدف (نهاية العداد التنازلي)
          </label>
          <p className="text-xs text-concrete mt-0.5">
            حدد اليوم والساعة التي سينتهي عندها العداد على شاشة الموقع.
          </p>
        </div>

        <input
          id="target-date-input"
          type="datetime-local"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          disabled={loading}
          className="w-full sm:max-w-md bg-obsidian border border-white/20 rounded-lg px-3.5 py-2 text-off-white text-sm focus:outline-none focus:border-white transition-colors"
        />
      </div>

      {/* 3. Image Selection & Upload */}
      <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <label className="block text-sm font-semibold text-off-white flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-concrete" />
              صورة الإطلاق (Coming Soon Banner)
            </label>
            <p className="text-xs text-concrete mt-0.5">
              يمكنك رفع صورة جديدة من جهازك أو تحديد رابط صورة مخصص (الأبعاد المثالية: 1024 × 434 عريضة).
            </p>
          </div>

          {/* Upload Button */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
              id="coming-soon-file-input"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-off-white text-xs font-semibold border border-white/20 transition-colors cursor-pointer disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? "جاري الرفع..." : "رفع صورة من جهازك"}
            </button>

            {imageUrl !== DEFAULT_IMAGE_URL && (
              <button
                type="button"
                onClick={handleResetImage}
                title="استعادة الصورة الافتراضية"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-concrete hover:text-off-white text-xs border border-white/10 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                استعادة الافتراضية
              </button>
            )}
          </div>
        </div>

        {/* URL Input */}
        <div>
          <label htmlFor="image-url-input" className="block text-xs text-concrete mb-1">
            رابط / مسار الصورة المباشر:
          </label>
          <input
            id="image-url-input"
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            disabled={loading}
            placeholder="/coming-soon.jpg"
            className="w-full bg-obsidian border border-white/20 rounded-lg px-3.5 py-2 text-off-white text-sm focus:outline-none focus:border-white font-mono text-xs transition-colors"
          />
        </div>

        {/* Live Preview Box */}
        <div className="space-y-2 pt-2">
          <span className="text-xs font-medium text-concrete">معاينة مباشرة لشكل البانر:</span>
          <div className="relative w-full max-w-xl aspect-[1024/434] rounded-xl overflow-hidden border border-white/20 bg-black shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl || DEFAULT_IMAGE_URL}
              alt="معاينة Coming Soon"
              className="w-full h-full object-cover sm:object-contain"
              onError={(e) => {
                // Fallback to default if custom url breaks
                (e.currentTarget as HTMLImageElement).src = DEFAULT_IMAGE_URL;
              }}
            />
          </div>
        </div>
      </div>

      {/* 4. Caption Input */}
      <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 sm:p-5 space-y-3">
        <div>
          <label htmlFor="caption-input" className="block text-sm font-semibold text-off-white flex items-center gap-2">
            <Type className="w-4 h-4 text-concrete" />
            نص توضيحي (Caption) اختياري
          </label>
          <p className="text-xs text-concrete mt-0.5">
            نص يظهر أسفل صورة Coming Soon بشكل أنيق للزوار (مثال: ترقبوا كولكشن الشتاء الأول قريباً).
          </p>
        </div>

        <input
          id="caption-input"
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={loading}
          placeholder="مثال: ترقبوا كولكشن الشتاء الأول قريباً | Raising The Standard"
          className="w-full bg-obsidian border border-white/20 rounded-lg px-3.5 py-2 text-off-white text-sm focus:outline-none focus:border-white transition-colors"
        />

        {caption.trim() && (
          <div className="p-3 rounded-lg bg-black/60 border border-white/10 text-center">
            <span className="text-xs text-concrete block mb-1">معاينة النص كما سيظهر للزوار:</span>
            <p className="text-sm font-medium text-concrete/95 tracking-wide">{caption.trim()}</p>
          </div>
        )}
      </div>

      {/* 5. Save Action Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => handleSaveSettings()}
          disabled={loading || uploading}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-off-white text-obsidian font-bold text-sm hover:bg-white transition-colors cursor-pointer disabled:opacity-50 shadow-md"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          حفظ جميع إعدادات Coming Soon
        </button>

        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/20 text-xs font-semibold text-off-white hover:bg-white/5 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          معاينة الواجهة كزائر ↗
        </a>
      </div>

      {/* Status feedback message */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-lg flex items-center gap-2.5 text-xs ${
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

      {/* Footer Info */}
      <div className="pt-2 border-t border-white/5">
        <p className="text-xs text-concrete leading-relaxed">
          💡 عند تفعيل الوضع أو تحديث الصورة أو الـ Caption، تنعكس التغييرات فورياً عبر البث المباشر (SSE) لجميع المتصفحات المفتوحة دون الحاجة لإعادة تحميل الصفحة. لوحة تحكم الإدارة تظل متاحة لك دائماً.
        </p>
      </div>
    </div>
  );
}
