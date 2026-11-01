"use client";

import { PageShell } from "@/components/layout/page-shell";
import { ProductGrid } from "@/components/drop/product-grid";
import { Reveal } from "@/components/motion/reveal";
import { useLocale } from "@/lib/locale-context";
import type { Product } from "@/content/home";

export function ShopView({ products }: { products: Product[] }) {
  const { t } = useLocale();

  return (
    <PageShell>
      <Reveal>
        <h1 className="text-h1">{t.shop.heading}</h1>
        <p className="mt-4 max-w-[55ch] text-graphite leading-relaxed">{t.shop.text}</p>
      </Reveal>
      <ProductGrid products={products} />
    </PageShell>
  );
}
