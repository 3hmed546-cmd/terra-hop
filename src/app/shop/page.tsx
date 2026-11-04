import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import { ShopView } from "@/components/shop/shop-view";
import { home, type Product } from "@/content/home";

export const metadata: Metadata = {
  title: "المتجر | Shop",
  description: "تشكيلة منتجات TERRA HOP - Drop 01",
};

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

export default function ShopPage() {
  const products = getCatalogProducts();
  return <ShopView products={products} />;
}
