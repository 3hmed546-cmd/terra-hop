"use client";

import { useState } from "react";
import { RevealItem } from "@/components/motion/reveal";
import { ProductCard } from "./product-card";
import { useLocale } from "@/lib/locale-context";
import type { Product } from "@/content/home";

type Props = { products: Product[] };

export function ProductGrid({ products }: Props) {
  const { t } = useLocale();
  const [filterKey, setFilterKey] = useState<"all" | "tshirts" | "hoodies">("all");

  const filterTabs = [
    { key: "all" as const, label: t.drop.categories.all },
    { key: "tshirts" as const, label: t.drop.categories.tshirts },
    { key: "hoodies" as const, label: t.drop.categories.hoodies },
  ];

  const visible = products.filter((p) => {
    if (filterKey === "all") return true;
    if (filterKey === "tshirts") return p.category === "T-shirts";
    if (filterKey === "hoodies") return p.category === "Hoodies";
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
        <p className="mt-8 text-graphite">{t.drop.empty}</p>
      )}
    </>
  );
}
