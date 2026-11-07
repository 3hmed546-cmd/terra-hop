"use client";

import { useMemo } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { ProductGrid } from "@/components/drop/product-grid";
import { Reveal } from "@/components/motion/reveal";
import { useLocale } from "@/lib/locale-context";
import { useLive } from "@/lib/use-live";
import type { Product } from "@/content/home";

export function ShopView({ products }: { products: Product[] }) {
  const { t } = useLocale();
  const { data: liveProducts } = useLive("products");

  const effectiveProducts = useMemo<Product[]>(() => {
    if (Array.isArray(liveProducts) && liveProducts.length > 0) {
      return liveProducts.map((p: any) => {
        const isSoldOut = p.forceSoldOut === true || p.status === "sold_out";
        return {
          slug: p.slug || p.id,
          name: p.name || p.nameAr,
          category: (p.category === "tshirt" || p.category === "T-shirts")
            ? "T-shirts"
            : (p.category === "pants" || p.category === "Pants")
            ? "Pants"
            : "Hoodies",
          price: (p.priceCents || 0) / 100,
          originalPrice: p.compareAtCents ? p.compareAtCents / 100 : undefined,
          status: isSoldOut ? "Sold out" : "Preorder",
          description: p.description || p.descriptionAr || "",
          sizes: Array.isArray(p.sizes) && p.sizes.length > 0
            ? Array.from(new Set(p.sizes))
            : Array.from(new Set((p.variants || []).map((v: any) => v.size).filter(Boolean))),
          images: (p.images || []).map((i: any) => (typeof i === "object" ? i.url : i)),
          colors: p.colors || [],
          variants: p.variants || [],
          href: `/shop/${p.slug || p.id}`,
          demo: false,
        };
      });
    }
    return products;
  }, [liveProducts, products]);

  return (
    <PageShell>
      <Reveal>
        <h1 className="text-h1">{t.shop.heading}</h1>
        <p className="mt-4 max-w-[55ch] text-graphite leading-relaxed">{t.shop.text}</p>
      </Reveal>
      <ProductGrid products={effectiveProducts} />
    </PageShell>
  );
}
