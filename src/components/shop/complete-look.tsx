"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, ShoppingBag, Sparkles, ArrowLeft, AlertTriangle } from "lucide-react";
import { useCart } from "@/lib/cart";
import type { Product } from "@/content/home";
import type { ProductLookConfig } from "@/lib/admin/types";

interface LookItemSelection {
  slug: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  selectedSize: string;
  selectedColor?: { id: string; name?: string; hex?: string; image?: string };
  availableSizes: string[];
  availableColors: any[];
}

interface CompleteLookProps {
  mainProduct: Product;
  lookConfig?: ProductLookConfig;
  allProducts: Product[];
}

/** Deduplicate and sort sizes in logical order (standard or pants sizes) */
function cleanAndSortSizes(sizes: string[], category?: string): string[] {
  const unique = Array.from(new Set((sizes || []).map((s) => String(s).trim()).filter(Boolean)));
  const baseOrder =
    category === "pants" || category === "Pants"
      ? ["28", "30", "32", "34", "36", "38", "40", "XS", "S", "M", "L", "XL", "XXL", "3XL", "One size"]
      : ["XS", "S", "M", "L", "XL", "XXL", "3XL", "28", "30", "32", "34", "36", "38", "40", "One size"];

  return unique.sort((a, b) => {
    const ia = baseOrder.indexOf(a);
    const ib = baseOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

function isProductSoldOut(product: Product): boolean {
  if (
    product.status === "Sold out" ||
    product.status === "sold_out" ||
    (product as any).forceSoldOut === true ||
    (product as any).isSoldOut === true
  ) {
    return true;
  }
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.every((v: any) => (v.stock ?? 0) <= 0 || v.available === false);
  }
  return false;
}

function checkVariantStock(product: Product, colorId?: string, size?: string): boolean {
  if (isProductSoldOut(product)) return false;
  const variants = product.variants;
  if (!Array.isArray(variants) || variants.length === 0) return true;

  const matching = variants.find((v: any) => {
    const matchColor = !colorId || String(v.colorId).toLowerCase() === String(colorId).toLowerCase();
    const matchSize = !size || String(v.size).toUpperCase() === String(size).toUpperCase();
    return matchColor && matchSize;
  });
  if (matching) {
    return (matching.stock ?? 0) > 0 && matching.available !== false;
  }
  const sizeVariants = variants.filter(
    (v: any) => !size || String(v.size).toUpperCase() === String(size).toUpperCase()
  );
  if (sizeVariants.length > 0) {
    return sizeVariants.some((v: any) => (v.stock ?? 0) > 0 && v.available !== false);
  }
  return false;
}

export function CompleteLook({ mainProduct, lookConfig, allProducts }: CompleteLookProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const { add } = useCart();
  const router = useRouter();

  // 1. Resolve Companion Products
  const companionProducts = useMemo(() => {
    if (!lookConfig?.enabled) return [];

    const targetIds = Array.isArray(lookConfig.productIds) ? lookConfig.productIds : [];
    const matched = targetIds
      .map((id) => allProducts.find((p) => p.slug === id || (p as any).id === id))
      .filter((p): p is Product => Boolean(p && p.slug !== mainProduct.slug));

    // Fallback if enabled but no specific companion IDs are selected yet: auto-select up to 2 other products
    if (matched.length === 0 && targetIds.length === 0) {
      return allProducts.filter((p) => p.slug !== mainProduct.slug).slice(0, 2);
    }

    return matched;
  }, [lookConfig, allProducts, mainProduct.slug]);

  // If look is not enabled or there are no companion items to pair with, don't show
  if (!lookConfig?.enabled || companionProducts.length === 0) {
    return null;
  }

  const allLookProducts = [mainProduct, ...companionProducts];

  return (
    <>
      {/* Complete Look Banner (Matching Reference Image) */}
      <section className="mt-14 sm:mt-16" aria-label="إطلالة متكاملة">
        <div className="rounded-3xl bg-white border border-stone-200/90 p-5 sm:p-7 shadow-xs hover:shadow-md transition-all">
          <div className="flex flex-col-reverse lg:flex-row items-center justify-between gap-6 sm:gap-8">
            {/* Left side: Thumbnails with + signs */}
            <div className="flex items-center justify-center gap-2 sm:gap-3.5 overflow-x-auto py-2 w-full lg:w-auto">
              {allLookProducts.map((item, idx) => {
                const rawImg = item.images?.[0];
                const imgSrc =
                  typeof rawImg === "object"
                    ? (rawImg as any).url || (rawImg as any).src
                    : rawImg || "/preview-images/hero.jpg";
                const isItemOut = isProductSoldOut(item);

                return (
                  <React.Fragment key={item.slug}>
                    {idx > 0 && (
                      <span className="text-xl sm:text-2xl font-black text-stone-300 select-none px-0.5 sm:px-1">
                        +
                      </span>
                    )}
                    <div className="group relative w-20 h-24 sm:w-24 sm:h-30 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 shadow-2xs shrink-0">
                      <Image
                        src={imgSrc}
                        alt={item.name}
                        fill
                        sizes="(min-width: 640px) 96px, 80px"
                        className={`object-cover transition-transform duration-300 group-hover:scale-105 ${
                          isItemOut ? "opacity-75" : ""
                        }`}
                        unoptimized={typeof imgSrc === "string" && (imgSrc.startsWith("data:") || imgSrc.startsWith("http"))}
                      />
                      {isItemOut && (
                        <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center p-1 text-center backdrop-blur-[0.5px]">
                          <span className="text-[10px] sm:text-xs font-black text-white bg-red-600/95 rounded px-1.5 py-0.5 shadow-xs leading-tight">
                            نفذ
                          </span>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Right side (RTL Arabic): Text Info & Action Button */}
            <div className="text-center lg:text-right flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5">
                <h3 className="text-xl sm:text-2xl font-black text-obsidian tracking-tight">
                  {lookConfig.title || "إطلالة متكاملة"}
                </h3>
                {Number(lookConfig.discountPercent) > 0 && (
                  <span
                    className="inline-flex items-center rounded-full px-3 py-0.5 text-xs font-black shadow-2xs"
                    style={{ backgroundColor: "#fdedee", color: "#b91c1c" }}
                  >
                    وفر {lookConfig.discountPercent}%
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-graphite max-w-lg">
                {lookConfig.subtitle || "نسق هذا المنتج مع قطع مختارة للحصول على ستايل متكامل."}
              </p>

              <div className="pt-2 flex justify-center lg:justify-start">
                <button
                  type="button"
                  onClick={() => setIsOpen(true)}
                  className="inline-flex items-center gap-2.5 rounded-xl bg-stone-900 px-6 py-3 text-xs sm:text-sm font-bold text-white hover:bg-black active:scale-95 transition-all shadow-md cursor-pointer group"
                >
                  <span>عرض الإطلالة</span>
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Look Selection Modal */}
      <AnimatePresence>
        {isOpen && (
          <LookModal
            lookProducts={allLookProducts}
            lookConfig={lookConfig}
            onClose={() => setIsOpen(false)}
            onAddToCart={(selections) => {
              selections.forEach((sel) => {
                add(sel.slug, sel.selectedSize, {
                  name: sel.selectedColor?.name,
                  hex: sel.selectedColor?.hex,
                  image: sel.selectedColor?.image || sel.image,
                });
              });
              setAddedSuccess(true);
              setTimeout(() => {
                setAddedSuccess(false);
                setIsOpen(false);
              }, 1200);
            }}
            onBuyNow={(selections) => {
              selections.forEach((sel) => {
                add(sel.slug, sel.selectedSize, {
                  name: sel.selectedColor?.name,
                  hex: sel.selectedColor?.hex,
                  image: sel.selectedColor?.image || sel.image,
                });
              });
              setIsOpen(false);
              router.push("/checkout");
            }}
            addedSuccess={addedSuccess}
          />
        )}
      </AnimatePresence>
    </>
  );
}

interface LookModalProps {
  lookProducts: Product[];
  lookConfig?: ProductLookConfig;
  onClose: () => void;
  onAddToCart: (selections: LookItemSelection[]) => void;
  onBuyNow: (selections: LookItemSelection[]) => void;
  addedSuccess: boolean;
}

function LookModal({
  lookProducts,
  lookConfig,
  onClose,
  onAddToCart,
  onBuyNow,
  addedSuccess,
}: LookModalProps) {
  // Initialize selections state for each product in the look with clean, deduplicated sizes
  const [selections, setSelections] = useState<LookItemSelection[]>(() => {
    return lookProducts.map((p) => {
      const rawImg = p.images?.[0];
      const imgSrc =
        typeof rawImg === "object"
          ? (rawImg as any).url || (rawImg as any).src
          : rawImg || "/preview-images/hero.jpg";

      const rawSizes =
        Array.isArray(p.sizes) && p.sizes.length > 0
          ? (p.sizes as string[])
          : (p.variants || []).map((v: any) => v.size).filter(Boolean);

      const sizes = cleanAndSortSizes(rawSizes, p.category);
      const safeSizes = sizes.length > 0 ? sizes : ["S", "M", "L", "XL", "XXL"];
      const colors = Array.isArray(p.colors) ? p.colors : [];

      // Default to first available size if possible
      const initialColor = colors.length > 0 ? colors[0] : undefined;
      const firstAvail = safeSizes.find((s) => checkVariantStock(p, initialColor?.id, s)) || safeSizes[0] || "L";

      return {
        slug: p.slug,
        name: p.name,
        price: p.price,
        originalPrice: p.originalPrice,
        image: initialColor?.image || imgSrc,
        selectedSize: firstAvail,
        selectedColor: initialColor,
        availableSizes: safeSizes,
        availableColors: colors,
      };
    });
  });

  const [soldOutAlert, setSoldOutAlert] = useState<{
    items: { selection: LookItemSelection; product: Product }[];
    mode: "cart" | "buy";
  } | null>(null);

  const updateSize = (idx: number, size: string) => {
    setSelections((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], selectedSize: size };
      return copy;
    });
  };

  const updateColor = (idx: number, color: any) => {
    setSelections((prev) => {
      const copy = [...prev];
      const prod = lookProducts[idx];
      let newImage = copy[idx].image;
      if (color?.image) {
        newImage = color.image;
      } else if (Array.isArray(prod?.images) && prod.images.length > 0) {
        const raw = prod.images[0];
        newImage = typeof raw === "object" ? (raw as any).url || (raw as any).src : raw;
      }

      copy[idx] = {
        ...copy[idx],
        selectedColor: color,
        image: newImage,
      };
      return copy;
    });
  };

  const rawSubtotal = useMemo(() => {
    return selections.reduce((sum, item) => sum + item.price, 0);
  }, [selections]);

  const discountPercent = Number(lookConfig?.discountPercent) || 0;
  const finalTotal = useMemo(() => {
    if (discountPercent > 0) {
      return Math.round(rawSubtotal * (1 - discountPercent / 100));
    }
    return rawSubtotal;
  }, [rawSubtotal, discountPercent]);

  const savedAmount = rawSubtotal - finalTotal;

  // Intercept Add To Cart when items are sold out
  const handleAddToCartAttempt = () => {
    const soldOuts = selections
      .map((sel, i) => ({ selection: sel, product: lookProducts[i] }))
      .filter(({ selection, product }) => {
        return (
          isProductSoldOut(product) ||
          !checkVariantStock(product, selection.selectedColor?.id, selection.selectedSize)
        );
      });

    if (soldOuts.length > 0) {
      setSoldOutAlert({ items: soldOuts, mode: "cart" });
      return;
    }

    onAddToCart(selections);
  };

  // Intercept Buy Now when items are sold out
  const handleBuyNowAttempt = () => {
    const soldOuts = selections
      .map((sel, i) => ({ selection: sel, product: lookProducts[i] }))
      .filter(({ selection, product }) => {
        return (
          isProductSoldOut(product) ||
          !checkVariantStock(product, selection.selectedColor?.id, selection.selectedSize)
        );
      });

    if (soldOuts.length > 0) {
      setSoldOutAlert({ items: soldOuts, mode: "buy" });
      return;
    }

    onBuyNow(selections);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 40 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-2xl rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-stone-200/90 overflow-hidden max-h-[90vh] flex flex-col text-right relative"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-obsidian">
                {lookConfig?.title || "إطلالة متكاملة"}
              </h3>
              <p className="text-xs text-graphite">
                حدد مقاس ولون كل قطعة لإكمال الطقم
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200/70 hover:bg-stone-300 flex items-center justify-center text-obsidian transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 divide-y divide-stone-100">
          {selections.map((item, idx) => {
            const product = lookProducts[idx];
            const isProdOut = isProductSoldOut(product);
            const isCurrentVarOut =
              isProdOut ||
              !checkVariantStock(product, item.selectedColor?.id, item.selectedSize);

            return (
              <div key={item.slug} className={`flex items-start gap-4 ${idx > 0 ? "pt-4" : ""}`}>
                {/* Product Thumbnail */}
                <div className="relative w-20 h-24 sm:w-24 sm:h-28 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="96px"
                    className={`object-cover ${isCurrentVarOut ? "opacity-75" : ""}`}
                    unoptimized={item.image.startsWith("data:") || item.image.startsWith("http")}
                  />
                  {isCurrentVarOut && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-1 text-center">
                      <span className="text-[10px] font-black text-white bg-red-600/90 rounded px-1.5 py-0.5 leading-tight">
                        نفذ
                      </span>
                    </div>
                  )}
                </div>

                {/* Product Details & Selectors */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-obsidian truncate">
                        {item.name}
                      </h4>
                      {isCurrentVarOut && (
                        <span className="inline-block mt-0.5 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.2">
                          نفذ من المخزون بالمقاس المحدد
                        </span>
                      )}
                    </div>
                    <span className="text-xs sm:text-sm font-mono font-black text-obsidian whitespace-nowrap">
                      {item.price} ج.م
                    </span>
                  </div>

                  {/* Color choices if any */}
                  {item.availableColors.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-graphite">اللون:</span>
                      <div className="flex items-center gap-1.5">
                        {item.availableColors.map((c) => {
                          const isSelected = item.selectedColor?.id === c.id;
                          const hex = /^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : "#000000";
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => updateColor(idx, c)}
                              className={`w-6 h-6 rounded-full border transition-all ${
                                isSelected
                                  ? "ring-2 ring-stone-900 ring-offset-1 scale-110 shadow-xs"
                                  : "border-stone-300 opacity-80 hover:opacity-100"
                              }`}
                              style={{ backgroundColor: hex }}
                              title={c.name}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Size Pills */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-graphite">المقاس:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {item.availableSizes.map((s) => {
                        const isSelected = item.selectedSize === s;
                        const isAvailable = checkVariantStock(product, item.selectedColor?.id, s);

                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => updateSize(idx, s)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-mono font-bold transition-all cursor-pointer ${
                              isSelected
                                ? "bg-stone-900 text-white shadow-xs"
                                : !isAvailable
                                ? "bg-stone-100 text-stone-400 line-through border border-stone-200/60"
                                : "bg-stone-100 text-obsidian hover:bg-stone-200 border border-stone-200/80"
                            }`}
                            title={!isAvailable ? "نفذ بالمقاس المحدد" : s}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer with Pricing & Add-to-Cart */}
        <div className="p-4 sm:p-6 border-t border-stone-200 bg-stone-50/70 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-graphite block">
                إجمالي الإطلالة ({selections.length} قطع):
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl sm:text-2xl font-mono font-black" style={{ color: "#c8102e" }}>
                  {finalTotal} ج.م
                </span>
                {discountPercent > 0 && (
                  <span className="text-xs sm:text-sm font-mono line-through text-stone-400">
                    {rawSubtotal} ج.م
                  </span>
                )}
              </div>
            </div>

            {discountPercent > 0 && savedAmount > 0 && (
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-black shadow-2xs"
                style={{ backgroundColor: "#fdedee", color: "#b91c1c" }}
              >
                وفرت {savedAmount} ج.م
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              disabled={addedSuccess}
              onClick={handleAddToCartAttempt}
              className="flex items-center justify-center gap-2 rounded-xl bg-stone-900 py-3 px-4 text-xs sm:text-sm font-bold text-white hover:bg-black active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-75"
            >
              {addedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>تمت الإضافة للسلة بنجاح!</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  <span>أضف الإطلالة بالكامل للسلة</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleBuyNowAttempt}
              className="flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white py-3 px-4 text-xs sm:text-sm font-bold text-obsidian hover:bg-stone-100 active:scale-95 transition-all cursor-pointer"
            >
              <span>طلب الإطلالة الآن مباشرة</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Branded Sold-Out Alert Modal */}
        <AnimatePresence>
          {soldOutAlert && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-stone-200 p-6 text-right"
                dir="rtl"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h4 className="text-base sm:text-lg font-black text-obsidian">
                        عفواً، قطعة نفذت من المخزون
                      </h4>
                      <p className="text-xs text-graphite">
                        بعض القطع المختارة في الإطلالة غير متوفرة حالياً
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSoldOutAlert(null)}
                    className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 transition-colors cursor-pointer"
                    aria-label="إغلاق"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Items Card */}
                <div className="space-y-3 my-4 max-h-[40vh] overflow-y-auto">
                  {soldOutAlert.items.map(({ selection }) => (
                    <div
                      key={selection.slug}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-stone-50 border border-stone-200/80"
                    >
                      <div className="relative w-16 h-20 rounded-xl overflow-hidden bg-stone-200 shrink-0">
                        <Image
                          src={selection.image}
                          alt={selection.name}
                          fill
                          sizes="64px"
                          className="object-cover opacity-75"
                          unoptimized={selection.image.startsWith("data:") || selection.image.startsWith("http")}
                        />
                        <span className="absolute bottom-1 right-1 left-1 text-center rounded bg-red-600 text-white font-bold text-[9px] py-0.5 shadow-xs">
                          نفذ
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <h5 className="text-xs sm:text-sm font-bold text-obsidian truncate">
                          {selection.name}
                        </h5>
                        <div className="flex items-center gap-2 text-xs text-graphite">
                          <span>
                            المقاس: <strong className="font-mono text-obsidian">{selection.selectedSize}</strong>
                          </span>
                          {selection.selectedColor?.name && (
                            <span>
                              • اللون: <strong className="text-obsidian">{selection.selectedColor.name}</strong>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-semibold text-red-600">
                          هذا المنتج غير متوفر حالياً بالمقاس المطلوب
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-stone-600 leading-relaxed mb-5">
                  يمكنك إكمال إضافة القطع المتوفرة فقط في الطقم، أو إغلاق هذه الرسالة وتعديل المقاس أو اللون.
                </p>

                {/* Action Buttons */}
                <div className="space-y-2">
                  {selections.some(
                    (sel, i) =>
                      checkVariantStock(lookProducts[i], sel.selectedColor?.id, sel.selectedSize) &&
                      !isProductSoldOut(lookProducts[i])
                  ) ? (
                    <button
                      type="button"
                      onClick={() => {
                        const availableOnly = selections.filter((sel, i) => {
                          const prod = lookProducts[i];
                          return (
                            !isProductSoldOut(prod) &&
                            checkVariantStock(prod, sel.selectedColor?.id, sel.selectedSize)
                          );
                        });
                        const mode = soldOutAlert.mode;
                        setSoldOutAlert(null);
                        if (mode === "cart") {
                          onAddToCart(availableOnly);
                        } else {
                          onBuyNow(availableOnly);
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-stone-900 py-3 px-4 text-xs sm:text-sm font-bold text-white hover:bg-black active:scale-95 transition-all shadow-md cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>
                        {soldOutAlert.mode === "cart"
                          ? "إضافة القطع المتوفرة فقط للسلة"
                          : "متابعة الطلب بالقطع المتوفرة"}
                      </span>
                    </button>
                  ) : (
                    <p className="text-xs font-bold text-red-600 text-center py-1">
                      للأسف جميع قطع الإطلالة المختارة غير متوفرة حالياً.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setSoldOutAlert(null)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white py-2.5 px-4 text-xs sm:text-sm font-bold text-obsidian hover:bg-stone-100 active:scale-95 transition-all cursor-pointer"
                  >
                    <span>تعديل المقاس أو الإلغاء</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
