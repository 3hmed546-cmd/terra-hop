import type { Metadata } from "next";
import { Suspense } from "react";
import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { ProductDetailView } from "@/components/shop/product-detail-view";
import { home, type Product } from "@/content/home";

import { readVaultFile } from "@/lib/server/vault-sync";

function getCatalogProducts(): Product[] {
  try {
    const raw = readVaultFile<any[]>("products-data.json");
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((p: any) => ({
        slug: p.slug,
        name: p.name || p.nameAr,
        category: (p.category === "tshirt" || p.category === "T-shirts") ? "T-shirts" : "Hoodies",
        price: (p.priceCents || 0) / 100,
        originalPrice: p.compareAtCents ? p.compareAtCents / 100 : undefined,
        status: p.forceSoldOut ? "Sold out" : "Preorder",
        description: p.description || p.descriptionAr || "",
        sizes: p.sizes || (p.variants || []).map((v: any) => v.size).filter(Boolean),
        images: (p.images || []).map((i: any) => (typeof i === "object" ? i.url : i)),
        colors: p.colors || [],
        variants: p.variants || [],
        href: `/shop/${p.slug}`,
        demo: false,
      }));
    }
  } catch {}
  return [...home.drop.products];
}

const findProduct = (slug: string) => {
  const all = getCatalogProducts();
  return all.find((p) => p.slug === slug || (p as any).id === slug);
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = findProduct(slug);
  return product ? { title: product.name, description: product.description } : {};
}

function ProductLoadingFallback() {
  return (
    <PageShell>
      <div className="min-h-[50vh] flex items-center justify-center text-graphite text-sm animate-pulse">
        جاري تحميل تفاصيل المنتج...
      </div>
    </PageShell>
  );
}

async function ProductContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = findProduct(slug);
  if (!product) notFound();
  const allProducts = getCatalogProducts();
  return <ProductDetailView product={product} allProducts={allProducts} />;
}

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<ProductLoadingFallback />}>
      <ProductContent params={params} />
    </Suspense>
  );
}
