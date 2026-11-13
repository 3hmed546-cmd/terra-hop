"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { RevealItem } from "@/components/motion/reveal";
import { ProductCard } from "./product-card";
import { useLocale } from "@/lib/locale-context";
import type { Product } from "@/content/home";

type Props = { products: Product[] };

export function ProductGrid({ products }: Props) {
  const { t, locale } = useLocale();
  const [filterKey, setFilterKey] = useState<"all" | "tshirts" | "hoodies" | "pants">("all");

  // When store / inventory has no products at all
  if (!products || products.length === 0) {
    return (
      <div className="mt-8 sm:mt-12 w-full flex flex-col items-center justify-center py-16 sm:py-20 px-6 rounded-2xl border border-stone-200/80 bg-stone-50/60 text-center shadow-xs">
        <div className="w-14 h-14 rounded-full bg-obsidian text-off-white flex items-center justify-center mb-4 shadow-sm">
          <Sparkles className="w-7 h-7 text-amber-400" />
        </div>
        <h3 className="font-bold text-xl sm:text-2xl text-obsidian tracking-tight">
          {locale === "ar"
            ? "ترقبونا قريبًا، انتظروا الدروب الشتوي قريبًا"
            : "The Winter Drop is Coming Soon · Stay Tuned"}
        </h3>
        <p className="mt-2 text-sm sm:text-base text-graphite max-w-md leading-relaxed">
          {locale === "ar"
            ? "المخزن فارغ حالياً ويجري تجهيز قطع الكولكشن الشتوي الجديد بعناية فائقة وتصاميم حصرية."
            : "The store inventory is currently empty. Our new exclusive winter drop is being crafted with the highest standards."}
        </p>
        <span className="mt-5 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-obsidian text-off-white text-xs font-mono uppercase tracking-widest">
          {locale === "ar" ? "🔥 إصدار شتوي محدود قريباً" : "🔥 Limited Winter Drop Coming Soon"}
        </span>
      </div>
    );
  }

  const filterTabs = [
    { key: "all" as const, label: t.drop.categories.all },
    { key: "tshirts" as const, label: t.drop.categories.tshirts },
    { key: "hoodies" as const, label: t.drop.categories.hoodies },
    { key: "pants" as const, label: t.drop.categories.pants },
  ];

  const visible = products.filter((p) => {
    if (filterKey === "all") return true;
    if (filterKey === "tshirts") return p.category === "T-shirts";
    if (filterKey === "hoodies") return p.category === "Hoodies";
    if (filterKey === "pants") return p.category === "Pants";
    return true;
  });

  return (
    <>
      <div role="group" aria-label="Product categories" className="mt-6 flex flex-wrap gap-x-2">
        {filterTabs.map((tab) => {
          const selected = tab.key === filterKey;
          return (
            <button
              key={tab.key}
              type="button"
              aria-pressed={selected}
              onClick={() => setFilterKey(tab.key)}
              className={`text-label min-h-11 px-2.5 py-1 underline-offset-8 transition-colors cursor-pointer hover:underline ${
                selected ? "underline decoration-2 text-obsidian font-bold" : "text-graphite font-normal"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {visible.length > 0 ? (
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
          {visible.map((p, i) => (
            <RevealItem key={`${filterKey}-${p.slug}`} index={i}>
              <ProductCard product={p} />
            </RevealItem>
          ))}
        </ul>
      ) : (
        <div className="mt-12 py-12 text-center border border-dashed border-stone-200 rounded-xl bg-stone-50/40">
          <p className="text-graphite text-sm sm:text-base">{t.drop.empty}</p>
        </div>
      )}
    </>
  );
}
