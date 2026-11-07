"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, ShoppingBag, Sparkles, ArrowLeft } from "lucide-react";
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
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        unoptimized={typeof imgSrc === "string" && (imgSrc.startsWith("data:") || imgSrc.startsWith("http"))}
                      />
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
  // Initialize selections state for each product in the look
  const [selections, setSelections] = useState<LookItemSelection[]>(() => {
    return lookProducts.map((p) => {
      const rawImg = p.images?.[0];
      const imgSrc =
        typeof rawImg === "object"
          ? (rawImg as any).url || (rawImg as any).src
          : rawImg || "/preview-images/hero.jpg";

      const sizes = Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes : ["S", "M", "L", "XL", "XXL"];
      const colors = Array.isArray(p.colors) ? p.colors : [];

      return {
        slug: p.slug,
        name: p.name,
        price: p.price,
        originalPrice: p.originalPrice,
        image: imgSrc,
        selectedSize: sizes[1] || sizes[0] || "L",
        selectedColor: colors.length > 0 ? colors[0] : undefined,
        availableSizes: sizes,
        availableColors: colors,
      };
    });
  });

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
      copy[idx] = { ...copy[idx], selectedColor: color };
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 40 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-2xl rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-stone-200/90 overflow-hidden max-h-[90vh] flex flex-col text-right"
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
          {selections.map((item, idx) => (
            <div key={item.slug} className={`flex items-start gap-4 ${idx > 0 ? "pt-4" : ""}`}>
              {/* Product Thumbnail */}
              <div className="relative w-20 h-24 sm:w-24 sm:h-28 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  sizes="96px"
                  className="object-cover"
                  unoptimized={item.image.startsWith("data:") || item.image.startsWith("http")}
                />
              </div>

              {/* Product Details & Selectors */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-obsidian truncate">
                    {item.name}
                  </h4>
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
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => updateSize(idx, s)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-mono font-bold transition-all cursor-pointer ${
                            isSelected
                              ? "bg-stone-900 text-white shadow-xs"
                              : "bg-stone-100 text-obsidian hover:bg-stone-200 border border-stone-200/80"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
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
              onClick={() => onAddToCart(selections)}
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
              onClick={() => onBuyNow(selections)}
              className="flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white py-3 px-4 text-xs sm:text-sm font-bold text-obsidian hover:bg-stone-100 active:scale-95 transition-all cursor-pointer"
            >
              <span>طلب الإطلالة الآن مباشرة</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
