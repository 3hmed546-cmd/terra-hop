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
  Smartphone,
  Monitor,
} from "lucide-react";
import { useLive } from "@/lib/use-live";
import { apiFetch } from "@/lib/admin-auth";

const DEFAULT_DESKTOP_IMAGE = "/coming-soon.jpg";
const DEFAULT_MOBILE_IMAGE = "/coming-soon-mobile.jpg";

export function ComingSoonSection() {
  const { data: liveSite } = useLive("settings");
  const [enabled, setEnabled] = useState(false);
  const [targetDate, setTargetDate] = useState("2026-11-20T00:00");
  const [imageUrl, setImageUrl] = useState(DEFAULT_DESKTOP_IMAGE);
  const [mobileImageUrl, setMobileImageUrl] = useState(DEFAULT_MOBILE_IMAGE);
  const [caption, setCaption] = useState("");

  const [loading, setLoading] = useState(false);
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const desktopFileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);

  // Sync with live database setting
  useEffect(() => {
    const cs = liveSite?.settings?.store?.coming_soon;
    if (cs) {
      setEnabled(Boolean(cs.enabled));
      if (cs.imageUrl) {
        setImageUrl(cs.imageUrl);
      }
      if (cs.mobileImageUrl) {
        setMobileImageUrl(cs.mobileImageUrl);
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
    override?: {
      newEnabled?: boolean;
      newDate?: string;
      newImage?: string;
      newMobileImage?: string;
      newCaption?: string;
    }
  ) {
    setLoading(true);
    setStatusMessage(null);

    const saveEnabled = override?.newEnabled !== undefined ? override.newEnabled : enabled;
    const saveDate = override?.newDate !== undefined ? override.newDate : targetDate;
    const saveImage = override?.newImage !== undefined ? override.newImage : imageUrl;
    const saveMobileImage = override?.newMobileImage !== undefined ? override.newMobileImage : mobileImageUrl;
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
            imageUrl: saveImage || DEFAULT_DESKTOP_IMAGE,
            mobileImageUrl: saveMobileImage || DEFAULT_MOBILE_IMAGE,
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
      setMobileImageUrl(saveMobileImage);
      setCaption(saveCaption);

      setStatusMessage({
        type: "success",
        text: "تم حفظ إعدادات Coming Soon بنجاح! التغييرات تظهر لحظياً لجميع الزوار على الكمبيوتر والهواتف.",
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

  async function handleFileUpload(file: File, isMobile: boolean) {
    if (isMobile) {
      setUploadingMobile(true);
    } else {
      setUploadingDesktop(true);
    }
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
      if (isMobile) {
        setMobileImageUrl(uploadedUrl);
        setStatusMessage({
          type: "success",
          text: "تم رفع صورة الهاتف بنجاح! اضغط 'حفظ جميع التغييرات' لاعتمادها على الموقع.",
        });
      } else {
        setImageUrl(uploadedUrl);
        setStatusMessage({
          type: "success",
          text: "تم رفع صورة الكمبيوتر بنجاح! اضغط 'حفظ جميع التغييرات' لاعتمادها على الموقع.",
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err?.message || "حدث خطأ أثناء رفع الصورة.",
      });
    } finally {
      if (isMobile) {
        setUploadingMobile(false);
        if (mobileFileInputRef.current) mobileFileInputRef.current.value = "";
      } else {
        setUploadingDesktop(false);
        if (desktopFileInputRef.current) desktopFileInputRef.current.value = "";
      }
    }
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

      {/* 3. Responsive Images Grid (Desktop Banner + Mobile Vertical Poster) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Desktop Banner Box */}
        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 sm:p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-sm font-semibold text-off-white flex items-center gap-2">
                <Monitor className="w-4 h-4 text-concrete" />
                صورة الكمبيوتر (Desktop Widescreen)
              </label>
              <span className="text-[11px] font-mono text-concrete bg-white/5 px-2 py-0.5 rounded border border-white/10">
                1024 × 434 عريضة
              </span>
            </div>
            <p className="text-xs text-concrete">
              تظهر على الشاشات الكبيرة واللابتوب بشكل سينمائي عريض.
            </p>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={desktopFileInputRef}
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], false)}
                accept="image/*"
                className="hidden"
                id="desktop-banner-file"
              />
              <button
                type="button"
                onClick={() => desktopFileInputRef.current?.click()}
                disabled={uploadingDesktop || loading}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-off-white text-xs font-semibold border border-white/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                {uploadingDesktop ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploadingDesktop ? "جاري الرفع..." : "رفع صورة من جهازك"}
              </button>

              {imageUrl !== DEFAULT_DESKTOP_IMAGE && (
                <button
                  type="button"
                  onClick={() => setImageUrl(DEFAULT_DESKTOP_IMAGE)}
                  title="استعادة الصورة الافتراضية"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-concrete hover:text-off-white text-xs border border-white/10 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  استعادة الافتراضية
                </button>
              )}
            </div>

            <div>
              <label htmlFor="desktop-url-input" className="block text-xs text-concrete mb-1">
                رابط أو مسار الصورة:
              </label>
              <input
                id="desktop-url-input"
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                disabled={loading}
                className="w-full bg-obsidian border border-white/20 rounded-lg px-3 py-1.5 text-off-white text-xs font-mono focus:outline-none focus:border-white transition-colors"
              />
            </div>
          </div>

          {/* Desktop Preview */}
          <div className="pt-2">
            <span className="text-[11px] text-concrete block mb-1.5">معاينة شاشة الكمبيوتر:</span>
            <div className="relative w-full aspect-[1024/434] rounded-lg overflow-hidden border border-white/15 bg-black shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl || DEFAULT_DESKTOP_IMAGE}
                alt="معاينة ديسك توب"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_DESKTOP_IMAGE;
                }}
              />
            </div>
          </div>
        </div>

        {/* Mobile Portrait Poster Box */}
        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 sm:p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-sm font-semibold text-off-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-concrete" />
                صورة الهاتف (Mobile Portrait)
              </label>
              <span className="text-[11px] font-mono text-concrete bg-white/5 px-2 py-0.5 rounded border border-white/10">
                768 × 1376 طولية
              </span>
            </div>
            <p className="text-xs text-concrete">
              تظهر على الهواتف الذكية وتملأ شاشة الموبايل بشكل متناسق ومريح.
            </p>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={mobileFileInputRef}
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], true)}
                accept="image/*"
                className="hidden"
                id="mobile-banner-file"
              />
              <button
                type="button"
                onClick={() => mobileFileInputRef.current?.click()}
                disabled={uploadingMobile || loading}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-off-white text-xs font-semibold border border-white/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                {uploadingMobile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploadingMobile ? "جاري الرفع..." : "رفع صورة من جهازك"}
              </button>

              {mobileImageUrl !== DEFAULT_MOBILE_IMAGE && (
                <button
                  type="button"
                  onClick={() => setMobileImageUrl(DEFAULT_MOBILE_IMAGE)}
                  title="استعادة الصورة الافتراضية"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-concrete hover:text-off-white text-xs border border-white/10 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  استعادة الافتراضية
                </button>
              )}
            </div>

            <div>
              <label htmlFor="mobile-url-input" className="block text-xs text-concrete mb-1">
                رابط أو مسار الصورة:
              </label>
              <input
                id="mobile-url-input"
                type="text"
                value={mobileImageUrl}
                onChange={(e) => setMobileImageUrl(e.target.value)}
                disabled={loading}
                className="w-full bg-obsidian border border-white/20 rounded-lg px-3 py-1.5 text-off-white text-xs font-mono focus:outline-none focus:border-white transition-colors"
              />
            </div>
          </div>

          {/* Mobile Preview */}
          <div className="pt-2">
            <span className="text-[11px] text-concrete block mb-1.5">معاينة شاشة الهاتف:</span>
            <div className="relative w-36 mx-auto aspect-[768/1376] rounded-lg overflow-hidden border border-white/15 bg-black shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mobileImageUrl || DEFAULT_MOBILE_IMAGE}
                alt="معاينة موبايل"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_MOBILE_IMAGE;
                }}
              />
            </div>
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
            نص يظهر أسفل صورة Coming Soon بشكل أنيق للزوار على الكمبيوتر والهاتف.
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
          disabled={loading || uploadingDesktop || uploadingMobile}
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
          💡 عند تحديث إعدادات الصور أو التاريخ أو الـ Caption، تنعكس التغييرات فورياً عبر البث المباشر (SSE) لجميع الشاشات المفتوحة مع مراعاة المقاس المثالي لكل جهاز تلقائياً.
        </p>
      </div>
    </div>
  );
}
