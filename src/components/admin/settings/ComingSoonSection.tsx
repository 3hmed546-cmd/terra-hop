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
  RotateCcw,
  Type,
  Smartphone,
  Monitor,
} from "lucide-react";
import { useLive } from "@/lib/use-live";
import { apiFetch } from "@/lib/admin-auth";

const DEFAULT_DESKTOP_IMAGE = "/coming-soon-desktop.jpg";
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
          text: "تم رفع صورة الهاتف بنجاح! اضغط 'حفظ جميع إعدادات Coming Soon' لاعتمادها على الموقع.",
        });
      } else {
        setImageUrl(uploadedUrl);
        setStatusMessage({
          type: "success",
          text: "تم رفع صورة الكمبيوتر بنجاح! اضغط 'حفظ جميع إعدادات Coming Soon' لاعتمادها على الموقع.",
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
    <div className="space-y-6 pt-1 text-neutral-900">
      {/* 1. Status Banner with Clean Toggle Switch */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all shadow-xs ${
          enabled
            ? "bg-amber-50/80 border-amber-300 text-amber-950"
            : "bg-emerald-50/80 border-emerald-300 text-emerald-950"
        }`}
      >
        <div className="flex items-start sm:items-center gap-3">
          <span
            className={`inline-flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${
              enabled ? "bg-amber-200 text-amber-900" : "bg-emerald-200 text-emerald-900"
            }`}
          >
            {enabled ? <Sparkles className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          </span>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-neutral-900">
              {enabled ? "وضع Coming Soon (قيد التشغيل الآن)" : "المتجر في الوضع الطبيعي (متاح لجميع الزوار)"}
            </h3>
            <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
              {enabled
                ? "الموقع يعرض صورة الإطلاق والعداد التنازلي لجميع الزوار مع إخفاء كتالوج المنتجات."
                : "جميع صفحات ومنتجات المتجر تعمل وتستقبل الطلبات بشكل كامل وطبيعي."}
            </p>
          </div>
        </div>

        {/* Clean iOS-style Toggle Button */}
        <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
          <span className="text-xs font-semibold text-neutral-700">
            {enabled ? "مفعّل" : "معطّل"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={handleToggle}
            disabled={loading}
            aria-label="تبديل وضع Coming Soon"
            className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 ${
              enabled ? "bg-emerald-600" : "bg-neutral-300"
            } ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
            dir="ltr"
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                enabled ? "translate-x-6" : "translate-x-0"
              }`}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 text-neutral-700 animate-spin" />
              ) : enabled ? (
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-neutral-400" />
              )}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Target Date Picker */}
      <div className="bg-neutral-50/70 border border-neutral-200 rounded-xl p-4 sm:p-5 space-y-3">
        <div>
          <label htmlFor="target-date-input" className="block text-sm font-bold text-neutral-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-neutral-700" />
            موعد الإطلاق المستهدف (نهاية العداد التنازلي)
          </label>
          <p className="text-xs text-neutral-600 mt-1">
            حدد اليوم والساعة التي سينتهي عندها العداد التنازلي على شاشة الموقع.
          </p>
        </div>

        <input
          id="target-date-input"
          type="datetime-local"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          disabled={loading}
          className="w-full sm:max-w-md bg-white border border-neutral-300 rounded-lg px-3.5 py-2 text-neutral-900 text-sm font-sans focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all shadow-xs"
        />
      </div>

      {/* 3. Responsive Images Grid (Desktop Banner + Mobile Vertical Poster) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Desktop Banner Box */}
        <div className="bg-neutral-50/70 border border-neutral-200 rounded-xl p-4 sm:p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-neutral-700" />
                صورة الكمبيوتر (Desktop Widescreen)
              </label>
              <span className="text-[11px] font-mono font-medium text-neutral-700 bg-neutral-200/80 px-2 py-0.5 rounded border border-neutral-300">
                16:9 عريضة (1920 × 1080)
              </span>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              تظهر على الشاشات الكبيرة وأجهزة اللابتوب بشكل سينمائي عريض.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
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
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-100 text-neutral-900 text-xs font-semibold border border-neutral-300 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {uploadingDesktop ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploadingDesktop ? "جاري الرفع..." : "رفع صورة من جهازك"}
              </button>

              {imageUrl !== DEFAULT_DESKTOP_IMAGE && (
                <button
                  type="button"
                  onClick={() => setImageUrl(DEFAULT_DESKTOP_IMAGE)}
                  title="استعادة الصورة الافتراضية"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 text-xs border border-neutral-300 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  استعادة الافتراضية
                </button>
              )}
            </div>

            <div className="pt-1">
              <label htmlFor="desktop-url-input" className="block text-xs font-semibold text-neutral-700 mb-1">
                رابط أو مسار الصورة:
              </label>
              <input
                id="desktop-url-input"
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                disabled={loading}
                dir="ltr"
                className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-1.5 text-neutral-900 text-xs font-mono focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all shadow-xs"
              />
            </div>
          </div>

          {/* Desktop Preview */}
          <div className="pt-2">
            <span className="text-xs font-semibold text-neutral-700 block mb-1.5">معاينة شاشة الكمبيوتر:</span>
            <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden border border-neutral-300 bg-neutral-900 shadow-sm">
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
        <div className="bg-neutral-50/70 border border-neutral-200 rounded-xl p-4 sm:p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-neutral-700" />
                صورة الهاتف (Mobile Portrait)
              </label>
              <span className="text-[11px] font-mono font-medium text-neutral-700 bg-neutral-200/80 px-2 py-0.5 rounded border border-neutral-300">
                9:16 طولية (576 × 1024)
              </span>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              تظهر على الهواتف الذكية وتملأ شاشة الموبايل بشكل متناسق ومريح.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
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
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-100 text-neutral-900 text-xs font-semibold border border-neutral-300 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {uploadingMobile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploadingMobile ? "جاري الرفع..." : "رفع صورة من جهازك"}
              </button>

              {mobileImageUrl !== DEFAULT_MOBILE_IMAGE && (
                <button
                  type="button"
                  onClick={() => setMobileImageUrl(DEFAULT_MOBILE_IMAGE)}
                  title="استعادة الصورة الافتراضية"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 text-xs border border-neutral-300 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  استعادة الافتراضية
                </button>
              )}
            </div>

            <div className="pt-1">
              <label htmlFor="mobile-url-input" className="block text-xs font-semibold text-neutral-700 mb-1">
                رابط أو مسار الصورة:
              </label>
              <input
                id="mobile-url-input"
                type="text"
                value={mobileImageUrl}
                onChange={(e) => setMobileImageUrl(e.target.value)}
                disabled={loading}
                dir="ltr"
                className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-1.5 text-neutral-900 text-xs font-mono focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all shadow-xs"
              />
            </div>
          </div>

          {/* Mobile Preview */}
          <div className="pt-2">
            <span className="text-xs font-semibold text-neutral-700 block mb-1.5 text-center">معاينة شاشة الهاتف:</span>
            <div className="relative w-36 mx-auto aspect-[576/1024] rounded-lg overflow-hidden border border-neutral-300 bg-neutral-900 shadow-sm">
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
      <div className="bg-neutral-50/70 border border-neutral-200 rounded-xl p-4 sm:p-5 space-y-3">
        <div>
          <label htmlFor="caption-input" className="block text-sm font-bold text-neutral-900 flex items-center gap-2">
            <Type className="w-4 h-4 text-neutral-700" />
            نص توضيحي (Caption) اختياري
          </label>
          <p className="text-xs text-neutral-600 mt-1">
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
          className="w-full bg-white border border-neutral-300 rounded-lg px-3.5 py-2 text-neutral-900 text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all shadow-xs placeholder:text-neutral-400"
        />

        {caption.trim() && (
          <div className="p-3 rounded-lg bg-white border border-neutral-200 text-center shadow-2xs">
            <span className="text-xs text-neutral-500 block mb-1">معاينة النص كما سيظهر للزوار:</span>
            <p className="text-sm font-semibold text-neutral-900 tracking-wide">{caption.trim()}</p>
          </div>
        )}
      </div>

      {/* 5. Save Action Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => handleSaveSettings()}
          disabled={loading || uploadingDesktop || uploadingMobile}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-neutral-900 text-white font-bold text-sm hover:bg-black transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          حفظ جميع إعدادات Coming Soon
        </button>

        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 transition-colors shadow-2xs"
        >
          <Eye className="w-3.5 h-3.5 text-neutral-600" />
          معاينة الواجهة كزائر ↗
        </a>
      </div>

      {/* Status feedback message */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-lg flex items-center gap-2.5 text-xs font-medium ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border border-emerald-300 text-emerald-900"
              : "bg-red-50 border border-red-300 text-red-900"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Footer Info */}
      <div className="pt-2 border-t border-neutral-200">
        <p className="text-xs text-neutral-500 leading-relaxed">
          ملاحظة: عند تحديث إعدادات الصور أو التاريخ أو الـ Caption، تنعكس التغييرات فورياً عبر البث المباشر (SSE) لجميع الشاشات المفتوحة مع مراعاة المقاس المثالي لكل جهاز تلقائياً.
        </p>
      </div>
    </div>
  );
}
