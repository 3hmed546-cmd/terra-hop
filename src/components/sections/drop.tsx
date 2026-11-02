"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { ProductGrid } from "@/components/drop/product-grid";
import { useLocale } from "@/lib/locale-context";
import { useLive } from "@/lib/use-live";
import type { home, Product } from "@/content/home";

export function Drop({ drop }: { drop: typeof home.drop }) {
  const { t } = useLocale();
  const { data: liveProducts } = useLive("products");

  const effectiveProducts = useMemo<Product[]>(() => {
    if (Array.isArray(liveProducts) && liveProducts.length > 0) {
      return liveProducts.map((p: any) => ({
        slug: p.slug || p.id,
        name: p.name || p.nameAr,
        category: (p.category === "tshirt" || p.category === "T-shirts") ? "T-shirts" : "Hoodies",
        price: (p.priceCents || 0) / 100,
        originalPrice: p.compareAtCents ? p.compareAtCents / 100 : undefined,
        status: p.forceSoldOut ? "Sold out" : "Preorder",
        description: p.description || p.descriptionAr || "",
        sizes: p.sizes || (p.variants || []).map((v: any) => v.size).filter(Boolean),
        images: (p.images || []).map((i: any) => (typeof i === "object" ? i.url : i)),
        href: `/shop/${p.slug || p.id}`,
        demo: false,
      }));
    }
    return drop.products;
  }, [liveProducts, drop.products]);

  return (
    <section aria-labelledby="drop-heading" className="pt-8 pb-16 lg:pt-12 lg:pb-24">
      <Container>
        <Reveal className="flex items-baseline justify-between gap-4">
          <h2 id="drop-heading" className="text-h1">{t.drop.heading}</h2>
          <Link href={drop.viewAll.href} className="text-label min-h-11 py-3 underline underline-offset-4">
            {t.drop.viewAll}
          </Link>
        </Reveal>
        <ProductGrid products={effectiveProducts} />
      </Container>
    </section>
  );
}
