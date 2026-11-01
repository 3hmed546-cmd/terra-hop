"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Trash2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import {
  GalleryImage,
  INITIAL_GALLERY_IMAGES,
  loadGalleryImages,
  deleteGalleryImage,
  addGalleryImage,
  resetGalleryImages,
  saveGalleryImages,
  getDeletedImageIds,
  getCustomImages,
  GALLERY_CHANNEL_NAME,
} from "@/lib/admin/gallery";
import { resizeImageToDataUrl } from "@/lib/admin/image-resize";

export function MediaGallery() {
  const [images, setImages] = useState<GalleryImage[]>(INITIAL_GALLERY_IMAGES);
  const [mounted, setMounted] = useState(false);

  // Modals state
  const [confirmTarget, setConfirmTarget] = useState<GalleryImage | null>(null);
  const [successDeletedName, setSuccessDeletedName] = useState<string | null>(null);
  const [successAddedName, setSuccessAddedName] = useState<string | null>(null);
  const [addCategory, setAddCategory] = useState<"header" | "clothing" | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Add Form state
  const [newTitle, setNewTitle] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newSrc, setNewSrc] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const refreshGallery = useCallback(() => {
    setImages(loadGalleryImages());
  }, []);

  useEffect(() => {
    refreshGallery();
    setMounted(true);

    // Initial fetch from server to sync if any other device made changes
    fetch("/api/media", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.images && Array.isArray(data.images)) {
          const localDeleted = new Set(getDeletedImageIds());
          const cleanServerImages = data.images.filter((img: GalleryImage) => !localDeleted.has(img.id));
          const localCustom = getCustomImages();
          const missingCustom = localCustom.filter((c) => !cleanServerImages.some((s: GalleryImage) => s.id === c.id));
          const merged = [...missingCustom, ...cleanServerImages];

          saveGalleryImages(merged, false);
          setImages(merged);

          // If the server still had deleted items, sync our authoritative clean state back to server
          const serverHadDeleted = data.images.some((img: GalleryImage) => localDeleted.has(img.id));
          if (serverHadDeleted || missingCustom.length > 0) {
            fetch("/api/media", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "sync", images: merged, deletedIds: Array.from(localDeleted) }),
            }).catch(() => {});
          }
        }
      })
      .catch(() => {});

    // Listen to real-time events across tabs
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        channel = new BroadcastChannel(GALLERY_CHANNEL_NAME);
        channel.onmessage = (e) => {
          if (e.data?.type === "UPDATE") {
            refreshGallery();
          }
        };
      } catch {
        // ignore
      }
    }

    const onSync = () => refreshGallery();
    window.addEventListener("terra_gallery_changed", onSync);
    window.addEventListener("storage", onSync);

    return () => {
      channel?.close();
      window.removeEventListener("terra_gallery_changed", onSync);
      window.removeEventListener("storage", onSync);
    };
  }, [refreshGallery]);

  const headerImages = images.filter((img) => img.category === "header");
  const clothingImages = images.filter((img) => img.category === "clothing");

  // Handle Deletion Execution
  async function handleConfirmDelete() {
    if (!confirmTarget) return;

    const target = confirmTarget;
    // 1. Delete image from state, localStorage, broadcast to tabs & server
    const nextImages = await deleteGalleryImage(target.id);
    setImages(nextImages);

    // 2. Close confirm popup & open success popup
    setConfirmTarget(null);
    setSuccessDeletedName(target.title);
  }

  // Handle Add Image Execution
  async function handleAddImage(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) {
      setAddError("يرجى إدخال اسم أو عنوان للصورة");
      return;
    }
    if (!newSrc.trim()) {
      setAddError("يرجى اختيار ملف صورة أو إدخال رابط الصورة");
      return;
    }

    const category = addCategory || "header";
    const newImage: GalleryImage = {
      id: `img-${Date.now()}`,
      title: newTitle.trim(),
      src: newSrc.trim(),
      category,
      tag: newTag.trim() || (category === "header" ? "صورة هيدر" : "صورة ملابس"),
      addedAt: new Date().toISOString().split("T")[0],
    };

    const nextImages = await addGalleryImage(newImage);
    setImages(nextImages);

    const addedTitle = newImage.title;
    setAddCategory(null);
    setNewTitle("");
    setNewTag("");
    setNewSrc("");
    setAddError(null);
    setSuccessAddedName(addedTitle);
  }

  // Handle File Input conversion to optimized lightweight base64 DataURL
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAddError("الملف المختار ليس صورة صالحة.");
      return;
    }

    setIsProcessingFile(true);
    setAddError(null);

    try {
      // Compress and resize image to fit comfortably in localStorage without quota errors
      const optimizedDataUrl = await resizeImageToDataUrl(file, 900, 0.82);
      setNewSrc(optimizedDataUrl);
      if (!newTitle) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setNewTitle(nameWithoutExt);
      }
    } catch {
      // Fallback to FileReader
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setNewSrc(reader.result);
          if (!newTitle) {
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
            setNewTitle(nameWithoutExt);
          }
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsProcessingFile(false);
    }
  }

  // Restore Default Images
  async function handleResetDefaults() {
    if (confirm("هل تريد استعادة جميع الصور الأولية؟")) {
      const reset = await resetGalleryImages();
      setImages(reset);
      setSuccessAddedName("تمت استعادة صور المعرض الأصلية بنجاح");
    }
  }

  if (!mounted) {
    return (
      <div className="adm-card p-8 text-center text-graphite">
        جاري تحميل معرض الصور...
      </div>
    );
  }

  return (
    <div className="space-y-12" dir="rtl">
      {/* Top Banner & Stats */}
      <div className="bg-obsidian text-off-white p-6 rounded-md shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-charcoal">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ImageIcon className="w-5 h-5 text-off-white" />
            <h2 className="text-xl font-bold tracking-wide">معرض وإدارة صور الموقع (Live Static)</h2>
          </div>
          <p className="text-xs text-concrete max-w-xl leading-relaxed">
            التحكم الكامل في جميع الصور المعروضة على المتجر. الصور مقسمة في أقسام مخصصة، مع ميزة التحديث اللحظي (Live Sync): عند حذف أو إضافة أي صورة يتم التحديث فوراً في الصفحة الرئيسية دون الحاجة لعمل Reload.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-xs font-mono">
            <span className="px-3 py-1.5 bg-charcoal rounded border border-concrete/30">
              الهيدرز: <strong>{headerImages.length}</strong>
            </span>
            <span className="px-3 py-1.5 bg-charcoal rounded border border-concrete/30">
              الملابس: <strong>{clothingImages.length}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs text-concrete hover:text-off-white transition-colors px-2 py-1 cursor-pointer"
            title="استعادة الصور الأصلية في حال حذفت شيئاً بالخطأ"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الكل</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. قسم صور الهيدرز والواجهة (Header & Hero Images)       */}
      {/* ======================================================== */}
      <section className="bg-off-white border-2 border-obsidian rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 bg-obsidian rounded-full"></span>
              <h3 className="text-lg font-bold text-obsidian tracking-wide">
                🖼️ صور الهيدرز والواجهة الرئيسية (Header & Hero Images)
              </h3>
              <span className="text-xs font-mono px-2 py-0.5 bg-obsidian text-off-white rounded">
                {headerImages.length} صورة
              </span>
            </div>
            <p className="text-xs text-graphite mt-1">
              هذه الصور تظهر في الهيرو والبانر المتحرك في أعلى الصفحة الرئيسية وفي صفحة تسجيل الدخول. الحذف هنا يزيلها فوراً من الهيرو لايف!
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setAddCategory("header");
              setNewTag("هيدر كاروسيل");
              setAddError(null);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-obsidian text-off-white text-xs font-bold rounded hover:bg-charcoal transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + إضافة صورة هيدر جديدة
          </button>
        </div>

        {/* Header Images Grid */}
        {headerImages.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-concrete rounded-md bg-white/50">
            <p className="text-sm font-semibold text-graphite">لا توجد صور هيدر معروضة حالياً.</p>
            <p className="text-xs text-concrete mt-1">يمكنك إضافة صور جديدة بالضغط على الزر أعلاه.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {headerImages.map((img) => (
              <div
                key={img.id}
                className="group relative bg-white border border-line rounded-lg overflow-hidden shadow-xs hover:shadow-md hover:border-obsidian transition-all flex flex-col justify-between"
              >
                {/* Image Container */}
                <div className="relative aspect-4/5 w-full bg-stone-100 overflow-hidden flex items-center justify-center">
                  <img
                    src={img.src}
                    alt={img.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <span className="absolute top-2 right-2 text-[10px] font-bold bg-obsidian/85 text-off-white px-2 py-0.5 rounded shadow">
                    {img.tag}
                  </span>
                </div>

                {/* Info & Actions */}
                <div className="p-3.5 bg-white flex flex-col gap-2">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-obsidian truncate" title={img.title}>
                      {img.title}
                    </h4>
                    <p className="text-[10px] text-graphite font-mono truncate dir-ltr text-right mt-0.5">
                      {img.src}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-line/60 flex items-center justify-between gap-2">
                    <a
                      href={img.src}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-graphite hover:text-obsidian inline-flex items-center gap-1 font-medium"
                      title="معاينة بالحجم الكامل"
                    >
                      <ExternalLink className="w-3 h-3" />
                      معاينة
                    </a>

                    <button
                      type="button"
                      onClick={() => setConfirmTarget(img)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* 2. قسم صور الملابس والمنتجات (Clothing & Products Images) */}
      {/* ======================================================== */}
      <section className="bg-off-white border-2 border-obsidian rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 bg-obsidian rounded-full"></span>
              <h3 className="text-lg font-bold text-obsidian tracking-wide">
                👕 صور الملابس والمنتجات (Clothing & Products Images)
              </h3>
              <span className="text-xs font-mono px-2 py-0.5 bg-obsidian text-off-white rounded">
                {clothingImages.length} صورة
              </span>
            </div>
            <p className="text-xs text-graphite mt-1">
              هذه الصور خاصة بالتيشيرتات، الهوديز، واللوك بوك المعروضة في المتجر وتفاصيل المنتجات.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setAddCategory("clothing");
              setNewTag("تيشيرت / هودي");
              setAddError(null);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-obsidian text-off-white text-xs font-bold rounded hover:bg-charcoal transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + إضافة صورة ملابس جديدة
          </button>
        </div>

        {/* Clothing Images Grid */}
        {clothingImages.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-concrete rounded-md bg-white/50">
            <p className="text-sm font-semibold text-graphite">لا توجد صور ملابس معروضة حالياً.</p>
            <p className="text-xs text-concrete mt-1">يمكنك إضافة صور جديدة بالضغط على الزر أعلاه.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {clothingImages.map((img) => (
              <div
                key={img.id}
                className="group relative bg-white border border-line rounded-lg overflow-hidden shadow-xs hover:shadow-md hover:border-obsidian transition-all flex flex-col justify-between"
              >
                {/* Image Container */}
                <div className="relative aspect-4/5 w-full bg-stone-100 overflow-hidden flex items-center justify-center">
                  <img
                    src={img.src}
                    alt={img.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <span className="absolute top-2 right-2 text-[10px] font-bold bg-obsidian/85 text-off-white px-2 py-0.5 rounded shadow">
                    {img.tag}
                  </span>
                </div>

                {/* Info & Actions */}
                <div className="p-3.5 bg-white flex flex-col gap-2">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-obsidian truncate" title={img.title}>
                      {img.title}
                    </h4>
                    <p className="text-[10px] text-graphite font-mono truncate dir-ltr text-right mt-0.5">
                      {img.src}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-line/60 flex items-center justify-between gap-2">
                    <a
                      href={img.src}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-graphite hover:text-obsidian inline-flex items-center gap-1 font-medium"
                      title="معاينة بالحجم الكامل"
                    >
                      <ExternalLink className="w-3 h-3" />
                      معاينة
                    </a>

                    <button
                      type="button"
                      onClick={() => setConfirmTarget(img)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* نافذة تأكيد الحذف (Confirmation Popup / Modal)            */}
      {/* ======================================================== */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-off-white border-2 border-obsidian rounded-xl max-w-md w-full p-6 shadow-2xl space-y-5 text-right"
            dir="rtl"
          >
            <div className="flex items-center gap-3 text-red-600 border-b border-line pb-3">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-obsidian">تأكيد حذف الصورة</h3>
                <p className="text-xs text-graphite">يرجى التأكيد قبل إزالة الصورة من العرض</p>
              </div>
            </div>

            {/* Target Image Preview */}
            <div className="flex items-center gap-4 p-3 bg-white border border-line rounded-lg">
              <div className="w-16 h-20 bg-stone-100 rounded overflow-hidden flex-none">
                <img
                  src={confirmTarget.src}
                  alt={confirmTarget.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-obsidian truncate">{confirmTarget.title}</p>
                <p className="text-[11px] text-graphite mt-0.5">
                  القسم: <strong>{confirmTarget.category === "header" ? "صور الهيدر" : "صور الملابس"}</strong>
                </p>
                <p className="text-[10px] text-concrete font-mono truncate dir-ltr text-right mt-1">
                  {confirmTarget.src}
                </p>
              </div>
            </div>

            <p className="text-xs text-graphite leading-relaxed">
              هل أنت متأكد أنك تريد حذف هذه الصورة نهائياً؟ بمجرد الضغط على <strong>موافق</strong> ستتم إزالتها فوراً وتحديث الصفحة الرئيسية دون الحاجة لـ Reload.
            </p>

            {/* Buttons: موافق / إلغاء */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="px-5 py-2.5 rounded border border-concrete text-obsidian hover:bg-stone-200 text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-6 py-2.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                موافق، احذف الصورة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* نافذة نجاح الحذف (Success Popup / Modal)                 */}
      {/* ======================================================== */}
      {successDeletedName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-off-white border-2 border-emerald-600 rounded-xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4"
            dir="rtl"
          >
            <div className="w-14 h-14 bg-emerald-100 border border-emerald-300 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-obsidian">تم الحذف بنجاح!</h3>
              <p className="text-xs text-graphite mt-1 leading-relaxed">
                تم حذف الصورة <strong>"{successDeletedName}"</strong> بنجاح من الصفحة والمعرض، وتحديث المحتوى المعروض في المتجر لحظياً.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSuccessDeletedName(null)}
                className="w-full py-2.5 bg-obsidian hover:bg-charcoal text-off-white text-xs font-bold rounded shadow transition-all cursor-pointer"
              >
                حسناً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* نافذة إضافة صورة جديدة (Add New Image Modal)             */}
      {/* ======================================================== */}
      {addCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-off-white border-2 border-obsidian rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-right"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-obsidian" />
                <h3 className="text-base font-bold text-obsidian">
                  إضافة صورة جديدة إلى {addCategory === "header" ? "صور الهيدر" : "صور الملابس"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAddCategory(null)}
                className="text-graphite hover:text-obsidian text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddImage} className="space-y-4">
              {addError && (
                <div className="p-3 bg-red-100 border border-red-300 rounded text-red-700 text-xs font-semibold">
                  ⚠️ {addError}
                </div>
              )}

              {/* Title Input */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-obsidian">اسم / عنوان الصورة:</label>
                <input
                  type="text"
                  placeholder="مثال: هودي رمادي أوفرسايز - كولكشن جديد"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-concrete rounded text-xs text-obsidian focus:outline-obsidian"
                  required
                />
              </div>

              {/* Tag Input */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-obsidian">التصنيف أو الشارة (Tag):</label>
                <input
                  type="text"
                  placeholder="مثال: هيدر رئيسي أو تيشيرت"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-concrete rounded text-xs text-obsidian focus:outline-obsidian"
                />
              </div>

              {/* File Upload Box */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-obsidian">رفع صورة من جهازك:</label>
                <label className="border-2 border-dashed border-concrete hover:border-obsidian rounded-lg p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-white transition-colors">
                  <Upload className={`w-6 h-6 ${isProcessingFile ? "animate-bounce text-obsidian" : "text-graphite"}`} />
                  <span className="text-xs font-semibold text-graphite">
                    {isProcessingFile ? "جاري معالجة وضغط الصورة..." : "اضغط هنا لاختيار صورة من جهازك"}
                  </span>
                  <span className="text-[10px] text-concrete">يدعم PNG, JPG, WEBP (يتم تحسينها وضغطها تلقائياً)</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isProcessingFile}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Or manual URL */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-obsidian">أو أدخل مسار / رابط الصورة:</label>
                <input
                  type="text"
                  placeholder="/preview-images/your-image.jpg أو https://..."
                  value={newSrc}
                  onChange={(e) => setNewSrc(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-concrete rounded text-xs text-obsidian font-mono text-left focus:outline-obsidian"
                />
              </div>

              {/* Preview if provided */}
              {newSrc && (
                <div className="p-3 bg-stone-100 border border-line rounded flex items-center gap-3">
                  <div className="w-12 h-16 bg-white rounded overflow-hidden flex-none border">
                    <img src={newSrc} alt="معاينة" className="w-full h-full object-cover" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-obsidian">معاينة الصورة المحددة</p>
                    <p className="text-[10px] text-graphite truncate max-w-xs">{newSrc.slice(0, 45)}...</p>
                  </div>
                </div>
              )}

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setAddCategory(null)}
                  className="px-4 py-2 border border-concrete rounded text-xs font-bold text-obsidian hover:bg-stone-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isProcessingFile || !newSrc}
                  className="px-6 py-2 bg-obsidian hover:bg-charcoal text-off-white rounded text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  + إضافة الصورة للمعرض
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* نافذة نجاح الإضافة (Success Add Popup / Modal)            */}
      {/* ======================================================== */}
      {successAddedName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-off-white border-2 border-emerald-600 rounded-xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4"
            dir="rtl"
          >
            <div className="w-14 h-14 bg-emerald-100 border border-emerald-300 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-obsidian">تمت الإضافة بنجاح!</h3>
              <p className="text-xs text-graphite mt-1 leading-relaxed">
                تمت إضافة الصورة <strong>"{successAddedName}"</strong> بنجاح إلى المعرض وتحديث الصفحة الرئيسية مباشرة بدون ريلود.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSuccessAddedName(null)}
                className="w-full py-2.5 bg-obsidian hover:bg-charcoal text-off-white text-xs font-bold rounded shadow transition-all cursor-pointer"
              >
                حسناً
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
