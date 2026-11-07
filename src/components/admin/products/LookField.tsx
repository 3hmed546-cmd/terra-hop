"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { Product, ProductLookConfig } from "@/lib/admin/types";
import { Checkbox, NumberInput, TextInput } from "../ui";

interface LookFieldProps {
  look?: ProductLookConfig;
  currentProductId: string;
  allProducts: Product[];
  onChange: (look: ProductLookConfig) => void;
}

export function LookField({ look, currentProductId, allProducts, onChange }: LookFieldProps) {
  const [search, setSearch] = useState("");

  const currentLook: ProductLookConfig = useMemo(() => {
    return {
      enabled: look?.enabled ?? false,
      title: look?.title ?? "إطلالة متكاملة",
      subtitle: look?.subtitle ?? "نسق هذا المنتج مع قطع مختارة للحصول على ستايل متكامل.",
      discountPercent: look?.discountPercent ?? 0,
      productIds: Array.isArray(look?.productIds) ? look.productIds : [],
    };
  }, [look]);

  const patch = (p: Partial<ProductLookConfig>) => {
    onChange({ ...currentLook, ...p });
  };

  const otherProducts = useMemo(() => {
    return allProducts.filter((p) => p.id !== currentProductId && p.slug !== currentProductId);
  }, [allProducts, currentProductId]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return otherProducts;
    return otherProducts.filter((p) => {
      const name = (p.name || (p as any).nameAr || "").toLowerCase();
      const slug = (p.slug || "").toLowerCase();
      return name.includes(q) || slug.includes(q);
    });
  }, [otherProducts, search]);

  const toggleProduct = (idOrSlug: string) => {
    const selected = currentLook.productIds || [];
    const exists = selected.includes(idOrSlug);
    let next: string[];
    if (exists) {
      next = selected.filter((id) => id !== idOrSlug);
    } else {
      if (selected.length >= 3) {
        // Replace or cap at 3
        next = [...selected.slice(0, 2), idOrSlug];
      } else {
        next = [...selected, idOrSlug];
      }
    }
    patch({ productIds: next });
  };

  const selectedProducts = useMemo(() => {
    return (currentLook.productIds || [])
      .map((id) => otherProducts.find((p) => p.id === id || p.slug === id))
      .filter(Boolean) as Product[];
  }, [currentLook.productIds, otherProducts]);

  return (
    <div className="space-y-6">
      {/* 1. Master Toggle */}
      <div className="rounded-xl border border-stone-200/90 bg-stone-50/70 p-4 transition-colors">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            className="w-5 h-5 rounded border-stone-300 text-stone-900 focus:ring-stone-900 accent-stone-900 cursor-pointer"
            checked={currentLook.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
          <div>
            <span className="text-sm font-bold text-obsidian block">
              تفعيل سكشن «إطلالة متكاملة» لهذا المنتج
            </span>
            <span className="text-xs text-graphite block mt-0.5">
              يعرض كارت الإطلالة في صفحة المنتج مع القطع المنسقة وزر إضافة الإطلالة بالكامل للسلة.
            </span>
          </div>
        </label>
      </div>

      {currentLook.enabled && (
        <div className="space-y-6 pt-2">
          {/* 2. Text & Discount Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput
              label="عنوان الإطلالة"
              value={currentLook.title || ""}
              placeholder="إطلالة متكاملة"
              maxLength={80}
              onChange={(e) => patch({ title: e.target.value })}
            />
            <NumberInput
              label="خصم ترويجي للإطلالة بالكامل (%)"
              value={currentLook.discountPercent ?? 0}
              min={0}
              max={90}
              hint="خصم اختياري يطبق عند شراء جميع قطع الإطلالة معاً"
              onChange={(n) => patch({ discountPercent: n ?? 0 })}
            />
          </div>

          <TextInput
            label="النص التوضيحي"
            value={currentLook.subtitle || ""}
            placeholder="نسق هذا المنتج مع قطع مختارة للحصول على ستايل متكامل."
            maxLength={180}
            onChange={(e) => patch({ subtitle: e.target.value })}
          />

          {/* 3. Product Selection Grid */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-obsidian">
                  اختر القطع المتناسقة للإطلالة ({currentLook.productIds.length} من 3 محددة)
                </h4>
                <p className="text-xs text-graphite">
                  انقر على المنتجات التي تكمل هذا الستايل (بنطال، تيشيرت، كاب، إلخ).
                </p>
              </div>
              {otherProducts.length > 4 && (
                <input
                  type="text"
                  placeholder="بحث في المنتجات..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-obsidian focus:outline-none focus:border-stone-400"
                />
              )}
            </div>

            {otherProducts.length === 0 ? (
              <p className="text-xs text-stone-500 py-3 bg-stone-50 rounded-lg text-center">
                لا توجد منتجات أخرى مضافة في المتجر حالياً لتنسيقها مع هذا المنتج. يمكنك إضافة منتجات جديدة وربطها هنا.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto p-1 border border-stone-200/80 rounded-xl bg-stone-50/40">
                {filteredProducts.map((p) => {
                  const idOrSlug = p.slug || p.id;
                  const isSelected = currentLook.productIds.includes(idOrSlug) || currentLook.productIds.includes(p.id);
                  const rawImg = p.images?.[0];
                  const imgSrc = typeof rawImg === "object" ? (rawImg as any).url || (rawImg as any).thumbUrl : rawImg || "/preview-images/hero.jpg";
                  const price = (p.priceCents || 0) / 100;

                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleProduct(idOrSlug)}
                      className={`relative flex flex-col rounded-xl border p-2.5 cursor-pointer transition-all ${
                        isSelected
                          ? "border-stone-900 bg-white shadow-md ring-2 ring-stone-900/10"
                          : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-xs"
                      }`}
                    >
                      <div className="relative aspect-[4/5] w-full rounded-lg overflow-hidden bg-stone-100 mb-2">
                        <Image
                          src={imgSrc}
                          alt={p.name || ""}
                          fill
                          sizes="120px"
                          className="object-cover"
                          unoptimized={typeof imgSrc === "string" && (imgSrc.startsWith("data:") || imgSrc.startsWith("http"))}
                        />
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-stone-900 text-white flex items-center justify-center text-xs font-bold shadow-md">
                            ✓
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-bold text-obsidian truncate">
                        {p.name || (p as any).nameAr || p.slug}
                      </span>
                      <span className="text-xs font-mono text-stone-600 font-bold mt-1">
                        {price} ج.م
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Live Visual Preview */}
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/50 p-4 space-y-2">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">
              معاينة حية لشكل كارت الإطلالة في صفحة المنتج:
            </span>

            <div className="rounded-2xl bg-white border border-stone-200 p-5 shadow-xs">
              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-5">
                {/* Thumbnails + signs */}
                <div className="flex items-center justify-center gap-2 overflow-x-auto py-1">
                  {/* Current main item preview */}
                  <div className="w-16 h-20 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-[10px] font-bold text-stone-500 shrink-0 text-center px-1">
                    القطعة الحالية
                  </div>

                  {selectedProducts.map((p) => {
                    const rawImg = p.images?.[0];
                    const imgSrc = typeof rawImg === "object" ? (rawImg as any).url || (rawImg as any).thumbUrl : rawImg || "/preview-images/hero.jpg";
                    return (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="text-stone-400 font-bold text-sm">+</span>
                        <div className="relative w-16 h-20 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0 shadow-2xs">
                          <Image
                            src={imgSrc}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-cover"
                            unoptimized={typeof imgSrc === "string" && (imgSrc.startsWith("data:") || imgSrc.startsWith("http"))}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {selectedProducts.length === 0 && (
                    <div className="flex items-center gap-2 text-xs text-stone-400">
                      <span>+</span>
                      <span className="italic">لم يتم اختيار قطع متناسقة بعد</span>
                    </div>
                  )}
                </div>

                {/* Text and Button */}
                <div className="text-right flex-1 space-y-1">
                  <div className="flex items-center justify-end gap-2">
                    {Number(currentLook.discountPercent) > 0 && (
                      <span className="rounded-full bg-red-50 text-red-600 px-2.5 py-0.5 text-[10px] font-bold border border-red-200">
                        وفر {currentLook.discountPercent}%
                      </span>
                    )}
                    <h5 className="text-sm font-black text-obsidian">
                      {currentLook.title || "إطلالة متكاملة"}
                    </h5>
                  </div>
                  <p className="text-xs text-graphite line-clamp-2">
                    {currentLook.subtitle || "نسق هذا المنتج مع قطع مختارة للحصول على ستايل متكامل."}
                  </p>
                  <div className="pt-2 flex justify-end">
                    <span className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white shadow-xs">
                      <span>عرض الإطلالة</span>
                      <span>←</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
