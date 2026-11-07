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
    const { getDb } = require("@/lib/server/db");
    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM products WHERE status = 'active' ORDER BY position ASC, created_at DESC")
      .all() as any[];

    if (Array.isArray(rows) && rows.length > 0) {
      let placements: any[] = [];
      try {
        placements = db
          .prepare(
            "SELECT p.*, a.sha256 FROM image_placements p JOIN assets a ON p.asset_id = a.id WHERE p.slot_key = 'product' AND p.active = 1 ORDER BY p.position ASC"
          )
          .all();
      } catch {}

      const imagesByProd = new Map<string, any[]>();
      for (const p of placements) {
        if (!p.owner_id) continue;
        const list = imagesByProd.get(p.owner_id) || [];
        let meta: any = {};
        try {
          meta = JSON.parse(p.meta || "{}");
        } catch {}
        list.push(meta.sourceUrl || `/media/${p.sha256}.webp`);
        imagesByProd.set(p.owner_id, list);
      }

      return rows.map((p: any) => {
        const imgs = imagesByProd.get(p.id) || [];
        let details = {};
        try {
          details = typeof p.details === "string" ? JSON.parse(p.details) : (p.details || {});
        } catch {}

        return {
          id: p.id,
          slug: p.slug,
          name: p.name_ar || p.name_en || p.slug,
          category: (p.category === "tshirt" || p.category === "T-shirts") ? "T-shirts" : "Hoodies",
          price: (p.price_cents || 0) / 100,
          originalPrice: p.compare_at_cents ? p.compare_at_cents / 100 : undefined,
          status: p.force_sold_out === 1 ? "Sold out" : "Preorder",
          description: p.description_ar || p.description_en || "",
          sizes: ["S", "M", "L", "XL", "XXL"],
          images: imgs.length > 0 ? imgs : ["/preview-images/hero.jpg"],
          colors: [],
          variants: [],
          details,
          href: `/shop/${p.slug}`,
          demo: false,
        };
      });
    }
  } catch {}

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
        details: p.details || {},
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
