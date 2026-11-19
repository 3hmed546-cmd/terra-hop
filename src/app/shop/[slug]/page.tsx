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
      .prepare("SELECT * FROM products WHERE status != 'archived' AND status != 'draft' ORDER BY position ASC, created_at DESC")
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

      let colorsByProd = new Map<string, any[]>();
      try {
        let colors: any[] = [];
        try {
          colors = db.prepare("SELECT id, product_id, name, hex, position, image_url as image FROM product_colors ORDER BY position ASC").all() as any[];
        } catch {
          colors = db.prepare("SELECT id, product_id, name, hex, position FROM product_colors ORDER BY position ASC").all() as any[];
        }
        for (const c of colors) {
          const list = colorsByProd.get(c.product_id) || [];
          list.push({ id: c.id, name: c.name, hex: c.hex, image: c.image || undefined });
          colorsByProd.set(c.product_id, list);
        }
      } catch {}

      let variantsByProd = new Map<string, any[]>();
      try {
        const variants = db.prepare("SELECT * FROM variants").all() as any[];
        for (const v of variants) {
          const list = variantsByProd.get(v.product_id) || [];
          list.push({
            id: v.id,
            colorId: v.color_id,
            size: v.size,
            stock: v.stock ?? 0,
            available: (v.stock ?? 0) > 0,
            stockStatus: (v.stock ?? 0) <= 0 ? "sold_out" : v.stock <= 3 ? "low" : "available",
          });
          variantsByProd.set(v.product_id, list);
        }
      } catch {}

      return rows.map((p: any) => {
        const imgs = imagesByProd.get(p.id) || [];
        const prodVariants = variantsByProd.get(p.id) || [];
        const prodColors = colorsByProd.get(p.id) || [];

        const isSoldOut =
          p.force_sold_out === 1 ||
          p.status === "sold_out" ||
          (prodVariants.length > 0 && prodVariants.every((v: any) => !v.available));

        const sizes =
          prodVariants.length > 0
            ? Array.from(new Set(prodVariants.map((v: any) => v.size).filter(Boolean)))
            : ["S", "M", "L", "XL", "XXL"];

        let details = {};
        try {
          details = typeof p.details === "string" ? JSON.parse(p.details) : (p.details || {});
        } catch {}

        return {
          id: p.id,
          slug: p.slug,
          name: p.name_ar || p.name_en || p.slug,
          category: (p.category === "tshirt" || p.category === "T-shirts")
            ? "T-shirts"
            : (p.category === "pants" || p.category === "Pants")
            ? "Pants"
            : "Hoodies",
          price: (p.price_cents || 0) / 100,
          originalPrice: p.compare_at_cents ? p.compare_at_cents / 100 : undefined,
          status: isSoldOut ? "Sold out" : "Preorder",
          description: p.description_ar || p.description_en || "",
          sizes: sizes as string[],
          images: imgs.length > 0 ? imgs : ["/preview-images/hero.jpg"],
          colors: prodColors,
          variants: prodVariants,
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
        category: (p.category === "tshirt" || p.category === "T-shirts")
          ? "T-shirts"
          : (p.category === "pants" || p.category === "Pants")
          ? "Pants"
          : "Hoodies",
        price: (p.priceCents || 0) / 100,
        originalPrice: p.compareAtCents ? p.compareAtCents / 100 : undefined,
        status: p.forceSoldOut ? "Sold out" : "Preorder",
        description: p.description || p.descriptionAr || "",
        sizes: Array.isArray(p.sizes) && p.sizes.length > 0
          ? Array.from(new Set(p.sizes))
          : Array.from(new Set((p.variants || []).map((v: any) => v.size).filter(Boolean))),
        images: (p.images || []).map((i: any) => (typeof i === "object" ? i.url : i)),
        colors: p.colors || [],
        variants: p.variants || [],
        details: p.details || {},
        href: `/shop/${p.slug}`,
        demo: false,
      }));
    }
  } catch {}
  return [];
}

const SLUG_ALIASES: Record<string, string> = {
  "charcoal-acid-hoodie": "charcoal-acid-hoodie",
  "dusty-cobalt-hoodie": "midnight-navy-raw-edge-hoodie",
  "alpine-forest-hoodie": "emerald-forest-heavyweight-hoodie",
  "vintage-mocha-hoodie": "mocha-brown-acid-wash-hoodie",
  "phantom-obsidian-hoodie": "obsidian-puff-print-hoodie",
};

const findProduct = (slug: string) => {
  const all = getCatalogProducts();
  const cleanSlug = decodeURIComponent(slug).trim().toLowerCase();

  // 1. Direct match by slug or id
  let match = all.find((p) => p.slug?.toLowerCase() === cleanSlug || (p as any).id?.toLowerCase() === cleanSlug);
  if (match) return match;

  // 2. Alias match
  const aliasTarget = SLUG_ALIASES[cleanSlug];
  if (aliasTarget) {
    match = all.find((p) => p.slug?.toLowerCase() === aliasTarget || (p as any).id?.toLowerCase() === aliasTarget);
    if (match) return match;
  }

  // 3. Fallback search by keywords in slug
  const keywords = ["charcoal", "cobalt", "navy", "forest", "emerald", "mocha", "brown", "obsidian", "black", "burgundy", "cream"];
  for (const kw of keywords) {
    if (cleanSlug.includes(kw)) {
      match = all.find((p) => (p.slug || "").toLowerCase().includes(kw) || (p.name || "").toLowerCase().includes(kw));
      if (match) return match;
    }
  }

  // 4. Default to first product if catalog is not empty instead of throwing 404
  return all.length > 0 ? all[0] : null;
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
