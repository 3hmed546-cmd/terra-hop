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
  Star,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  GalleryImage,
  fetchHeroImages,
  deleteHeroImage,
  addHeroImage,
  GALLERY_CHANNEL_NAME,
} from "@/lib/admin/gallery";
import { apiFetch } from "@/lib/admin-auth";
import { resizeImageToDataUrl } from "@/lib/admin/image-resize";
import { useAdminStore, reloadAdminData } from "@/lib/admin/store";
import { formatPrice } from "@/lib/format";
import type { Product, ProductImage } from "@/lib/admin/types";

type ConfirmDeleteTarget =
  | { type: "header"; image: GalleryImage }
  | { type: "product"; product: Product; image: ProductImage };

export function MediaGallery() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [mounted, setMounted] = useState(false);

  // Admin store for live synchronized products
  const { data: adminData, actions: adminActions } = useAdminStore();
  const products = adminData?.products || [];

  // Modals state
  const [confirmTarget, setConfirmTarget] = useState<ConfirmDeleteTarget | null>(null);
  const [successDeletedName, setSuccessDeletedName] = useState<string | null>(null);
  const [successAddedName, setSuccessAddedName] = useState<string | null>(null);

  // Add Target: header image or specific product
  const [addMode, setAddMode] = useState<"header" | "product" | null>(null);
  const [addProductTarget, setAddProductTarget] = useState<Product | null>(null);

  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Add Form state
  const [newTitle, setNewTitle] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newSrc, setNewSrc] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  // Selected product filter for albums
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>("all");

  const refreshGallery = useCallback(async () => {
    try {
      const liveImages = await fetchHeroImages();
      setImages(liveImages);
    } catch {
      // Keep existing state if offline
    }
  }, []);

  useEffect(() => {
    refreshGallery();
    setMounted(true);

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
      } catch {}
    }

    return () => {
      channel?.close();
    };
  }, [refreshGallery]);

  const headerImages = images.filter((img) => img.category === "header");

  // Handle Deletion Execution
  async function handleConfirmDelete() {
    if (!confirmTarget) return;

    if (confirmTarget.type === "header") {
      const target = confirmTarget.image;
      try {
        await deleteHeroImage(target.id);
        const next = await fetchHeroImages();
        setImages(next);
        setConfirmTarget(null);
        setSuccessDeletedName(`صورة الهيدر "${target.title}"`);
      } catch (err: any) {
        setConfirmTarget(null);
        alert(err.message || "فشل حذف صورة الهيدر من الخادم.");
      }
      return;
    }

    if (confirmTarget.type === "product") {
      const { product, image } = confirmTarget;
      try {
        const res = await apiFetch(`/api/admin/slots/product/items/${encodeURIComponent(image.id)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || "فشل حذف الصورة من السيرفر.");
        }
        const updatedImages = (product.images || []).filter((img) => img.id !== image.id);
        const updated: Product = { ...product, images: updatedImages, updatedAt: new Date().toISOString() };
        adminActions.saveProduct(updated);
        setConfirmTarget(null);
        setSuccessDeletedName(`صورة ${image.alt || product.name} من ألبوم (${product.name})`);
        await reloadAdminData();
      } catch (err: any) {
        setConfirmTarget(null);
        alert(err.message || "فشل حذف صورة المنتج من الخادم.");
      }
    }
  }

  // Handle Setting Primary Image for a Product
  async function handleSetPrimaryImage(product: Product, imageId: string) {
    const targetImg = product.images.find((img) => img.id === imageId);
    if (!targetImg) return;
    const reordered = [targetImg, ...product.images.filter((img) => img.id !== imageId)];
    const updated: Product = { ...product, images: reordered, updatedAt: new Date().toISOString() };
    adminActions.saveProduct(updated);

    try {
      const ids = reordered.map((img) => img.id);
      const res = await apiFetch(`/api/admin/slots/product/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, ownerId: product.id }),
      });
      if (res.ok) {
        await reloadAdminData();
      }
    } catch (err) {
      console.error("Failed to reorder images on server:", err);
    }
  }

  // Handle Add Image Execution
  async function handleAddImage(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) {
      setAddError("يرجى إدخال اسم أو وصف للصورة");
      return;
    }
    if (!newSrc.trim() && !uploadFile) {
      setAddError("يرجى اختيار ملف صورة أو إدخال رابط الصورة");
      return;
    }

    setIsProcessingFile(true);
    setAddError(null);

    try {
      if (addMode === "header") {
        await addHeroImage({
          file: uploadFile || undefined,
          title: newTitle.trim(),
          meta: { tag: newTag.trim() || "هيدر كاروسيل" },
        });

        const next = await fetchHeroImages();
        setImages(next);
        const addedTitle = newTitle.trim();
        resetAddForm();
        setSuccessAddedName(`صورة الهيدر "${addedTitle}"`);
        return;
      }

      if (addMode === "product" && addProductTarget) {
        const product = addProductTarget;
        const formData = new FormData();
        if (uploadFile) {
          formData.append("file", uploadFile);
        }
        formData.append("altAr", newTitle.trim());
        formData.append("altEn", newTitle.trim());
        formData.append("ownerId", product.id);

        const res = await apiFetch("/api/admin/slots/product/items", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || "فشل إضافة الصورة لهذا المنتج.");
        }

        await adminActions.saveProduct(product);
        const pName = product.name;
        resetAddForm();
        setSuccessAddedName(`صورة جديدة لألبوم (${pName})`);
      }
    } catch (err: any) {
      setAddError(err.message || "حدث خطأ أثناء رفع وحفظ الصورة.");
    } finally {
      setIsProcessingFile(false);
    }
  }

  function resetAddForm() {
    setAddMode(null);
    setAddProductTarget(null);
    setUploadFile(null);
    setNewTitle("");
    setNewTag("");
    setNewSrc("");
    setAddError(null);
  }

  // Handle File Input conversion to preview
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAddError("الملف المختار ليس صورة صالحة.");
      return;
    }

    setUploadFile(file);
    setIsProcessingFile(true);
    setAddError(null);

    try {
      const optimizedDataUrl = await resizeImageToDataUrl(file, 900, 0.82);
      setNewSrc(optimizedDataUrl);
      if (!newTitle) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setNewTitle(nameWithoutExt);
      }
    } catch {
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

  // Refresh from Server
  async function handleResetDefaults() {
    await refreshGallery();
  }

  if (!mounted) {
    return (
      <div className="adm-card p-8 text-center text-graphite font-bold">
        جاري تحميل معرض الصور وإدارة الوسائط...
      </div>
    );
  }

  const filteredProducts =
    selectedProductFilter === "all"
      ? products
      : products.filter((p) => p.id === selectedProductFilter || p.slug === selectedProductFilter);

  const totalProductImages = products.reduce((sum, p) => sum + (p.images?.length || 0), 0);

  return (
    <div className="space-y-12" dir="rtl">
      {/* Top Banner & Stats */}
      <div className="bg-obsidian text-off-white p-6 rounded-md shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-charcoal">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ImageIcon className="w-5 h-5 text-off-white" />
            <h2 className="text-xl font-bold tracking-wide">إدارة صور الموقع والمنتجات (Live Static)</h2>
          </div>
          <p className="text-xs text-concrete max-w-xl leading-relaxed">
            التحكم الكامل واللحظي في جميع صور المتجر. الصور مقسمة في ألبومات مستقلة لكل هودي ومنتج على حدة، بالإضافة لقسم صور الهيدرز. أي تعديل أو حذف أو إضافة يتحدث فوراً في المتجر بدون ريلود (Live Static).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-xs font-mono">
            <span className="px-3 py-1.5 bg-charcoal rounded border border-concrete/30">
              الهيدرز: <strong>{headerImages.length}</strong>
            </span>
            <span className="px-3 py-1.5 bg-charcoal rounded border border-concrete/30">
              صور المنتجات: <strong>{totalProductImages}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs text-concrete hover:text-off-white transition-colors px-2 py-1 cursor-pointer"
            title="استعادة الصور الأصلية في حال حذفت شيئاً بالخطأ"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الهيدرز</span>
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
              setAddMode("header");
              setAddProductTarget(null);
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
                      onClick={() => setConfirmTarget({ type: "header", image: img })}
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
      {/* 2. قسم ألبومات صور المنتجات (Product Photo Albums)         */}
      {/* ======================================================== */}
      <section className="bg-off-white border-2 border-obsidian rounded-lg p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 bg-red-600 rounded-full"></span>
              <h3 className="text-lg font-bold text-obsidian tracking-wide">
                👕 ألبومات صور المنتجات والهوديز (Product Photo Albums)
              </h3>
              <span className="text-xs font-mono px-2 py-0.5 bg-red-600 text-white rounded font-bold">
                {products.length} منتجات
              </span>
            </div>
            <p className="text-xs text-graphite mt-1">
              لكل هودي ومنتج ألبوم صور خاص به. يمكنك إضافة صور حصرية للمنتج، حذف أي صورة، أو تعيين الصورة الرئيسية كغلاف. التعديل هنا يظهر فوراً في المتجر دون الحاجة لـ Reload.
            </p>
          </div>

          {/* Filter by Product */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-obsidian">عرض منتج:</label>
            <select
              value={selectedProductFilter}
              onChange={(e) => setSelectedProductFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-concrete rounded text-xs text-obsidian font-bold focus:outline-obsidian cursor-pointer"
            >
              <option value="all">جميع المنتجات ({products.length})</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Albums List */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-concrete rounded-md bg-white/50">
            <p className="text-sm font-semibold text-graphite">لا توجد منتجات مسجلة حالياً.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredProducts.map((product) => {
              const productImages = product.images || [];
              const mainColor = product.colors?.[0]?.hex || "#080808";

              return (
                <div
                  key={product.id}
                  className="bg-white border-2 border-line hover:border-obsidian rounded-xl p-5 shadow-xs transition-all space-y-4"
                >
                  {/* Album Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line/60">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-4 h-4 rounded-full border border-stone-300 shadow-xs shrink-0"
                        style={{ backgroundColor: mainColor }}
                        title={product.colors?.[0]?.name}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm sm:text-base font-extrabold text-obsidian">
                            {product.name}
                          </h4>
                          <span className="text-[11px] font-mono px-2 py-0.5 bg-stone-100 text-stone-700 rounded border">
                            {formatPrice(product.priceCents / 100)}
                          </span>
                        </div>
                        <p className="text-[11px] text-graphite font-mono dir-ltr text-right mt-0.5">
                          ID: {product.id} • {productImages.length} صور في الألبوم
                        </p>
                      </div>
                    </div>

                    {/* Add Photo Button for this product */}
                    <button
                      type="button"
                      onClick={() => {
                        setAddMode("product");
                        setAddProductTarget(product);
                        setNewTitle(`${product.name} - صورة إضافية`);
                        setNewTag("صورة منتج");
                        setAddError(null);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-obsidian text-off-white text-xs font-bold rounded hover:bg-charcoal transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      + إضافة صورة لهذا الهودي
                    </button>
                  </div>

                  {/* Album Photos Grid */}
                  {productImages.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-stone-200 rounded-lg bg-stone-50">
                      <p className="text-xs text-graphite font-semibold">لا توجد صور لهذا المنتج حتى الآن.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setAddMode("product");
                          setAddProductTarget(product);
                          setNewTitle(product.name);
                          setAddError(null);
                        }}
                        className="mt-2 text-xs font-bold text-red-600 hover:underline cursor-pointer"
                      >
                        + اضغط هنا لإضافة الصورة الأولى
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {productImages.map((pImg, idx) => {
                        const isPrimary = idx === 0;

                        return (
                          <div
                            key={pImg.id || pImg.url}
                            className={`group relative bg-stone-50 border rounded-lg overflow-hidden flex flex-col justify-between transition-all ${
                              isPrimary
                                ? "border-red-600 ring-2 ring-red-600/20 shadow-sm"
                                : "border-line hover:border-obsidian"
                            }`}
                          >
                            {/* Image Box */}
                            <div className="relative aspect-4/5 w-full bg-stone-100 overflow-hidden flex items-center justify-center">
                              <img
                                src={pImg.url}
                                alt={pImg.alt || product.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                              />

                              {/* Badges */}
                              {isPrimary ? (
                                <span className="absolute top-2 right-2 text-[10px] font-black bg-red-600 text-white px-2 py-0.5 rounded shadow flex items-center gap-1">
                                  <Star className="w-2.5 h-2.5 fill-white" />
                                  الغلاف الرئيسي
                                </span>
                              ) : (
                                <span className="absolute top-2 right-2 text-[10px] font-bold bg-black/70 text-white px-1.5 py-0.5 rounded">
                                  صورة {idx + 1}
                                </span>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="p-2.5 bg-white flex flex-col gap-1.5 border-t border-line/60">
                              <p className="text-[10px] text-obsidian font-bold truncate" title={pImg.alt || product.name}>
                                {pImg.alt || `صورة ${idx + 1}`}
                              </p>

                              <div className="flex items-center justify-between gap-1 pt-1 border-t border-line/40">
                                {!isPrimary && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetPrimaryImage(product, pImg.id)}
                                    className="text-[10px] font-bold text-obsidian hover:text-red-600 hover:underline cursor-pointer"
                                    title="تعيين كصورة رئيسية للمنتج تظهر على الكارت أولاً"
                                  >
                                    تعيين كغلاف
                                  </button>
                                )}

                                <a
                                  href={pImg.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-graphite hover:text-obsidian inline-flex items-center gap-0.5 font-medium ml-auto"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  معاينة
                                </a>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmTarget({
                                      type: "product",
                                      product,
                                      image: pImg,
                                    })
                                  }
                                  className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-bold text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                  title="حذف هذه الصورة من المنتج"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  حذف
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
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
                <p className="text-xs text-graphite">يرجى التأكيد قبل إزالة الصورة نهائياً</p>
              </div>
            </div>

            {/* Target Image Preview */}
            <div className="flex items-center gap-4 p-3 bg-white border border-line rounded-lg">
              <div className="w-16 h-20 bg-stone-100 rounded overflow-hidden flex-none">
                <img
                  src={confirmTarget.type === "header" ? confirmTarget.image.src : confirmTarget.image.url}
                  alt={confirmTarget.type === "header" ? confirmTarget.image.title : confirmTarget.image.alt}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-obsidian truncate">
                  {confirmTarget.type === "header" ? confirmTarget.image.title : confirmTarget.image.alt || confirmTarget.product.name}
                </p>
                <p className="text-[11px] text-graphite mt-0.5">
                  القسم:{" "}
                  <strong>
                    {confirmTarget.type === "header"
                      ? "صور الهيدر"
                      : `ألبوم هودي: ${confirmTarget.product.name}`}
                  </strong>
                </p>
                <p className="text-[10px] text-concrete font-mono truncate dir-ltr text-right mt-1">
                  {confirmTarget.type === "header" ? confirmTarget.image.src : confirmTarget.image.url}
                </p>
              </div>
            </div>

            <p className="text-xs text-graphite leading-relaxed">
              هل أنت متأكد أنك تريد حذف هذه الصورة نهائياً؟ بمجرد الضغط على <strong>موافق، احذف الصورة</strong> ستتم إزالتها فوراً وتحديث الصفحة والمعرض دون الحاجة لـ Reload.
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
                تم حذف <strong>"{successDeletedName}"</strong> بنجاح وتحديث المحتوى المعروض في المتجر لحظياً.
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
      {addMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-off-white border-2 border-obsidian rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-right"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-obsidian" />
                <h3 className="text-base font-bold text-obsidian">
                  {addMode === "header"
                    ? "إضافة صورة جديدة إلى صور الهيدر"
                    : `إضافة صورة جديدة لألبوم (${addProductTarget?.name})`}
                </h3>
              </div>
              <button
                type="button"
                onClick={resetAddForm}
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
                <label className="block text-xs font-bold text-obsidian">اسم / وصف الصورة:</label>
                <input
                  type="text"
                  placeholder={
                    addMode === "header"
                      ? "مثال: هيرو بانر كولكشن الشتاء"
                      : "مثال: الموديل يرتدي الهودي من زاوية جانبية"
                  }
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-concrete rounded text-xs text-obsidian focus:outline-obsidian font-bold"
                  required
                />
              </div>

              {/* Tag Input for Header */}
              {addMode === "header" && (
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-obsidian">التصنيف أو الشارة (Tag):</label>
                  <input
                    type="text"
                    placeholder="مثال: هيدر رئيسي أو بانر"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-concrete rounded text-xs text-obsidian focus:outline-obsidian"
                  />
                </div>
              )}

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
                  placeholder="/login-hoodies/hoodie-black.webp أو https://..."
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
                  onClick={resetAddForm}
                  className="px-4 py-2 border border-concrete rounded text-xs font-bold text-obsidian hover:bg-stone-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isProcessingFile || !newSrc}
                  className="px-6 py-2 bg-obsidian hover:bg-charcoal text-off-white rounded text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  + إضافة الصورة وتحديث المتجر فوراً
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
                تمت إضافة <strong>"{successAddedName}"</strong> بنجاح وتحديث المتجر مباشرة بدون ريلود (Live Static).
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
