import { NextRequest } from "next/server";
import crypto from "crypto";
import { getDb, getLatestRevision } from "@/lib/server/db";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";

export async function GET(request: NextRequest) {
  try {
    seedDatabaseIfNeeded();
    const db = getDb();

  const products = db
    .prepare("SELECT * FROM products WHERE status = 'active' ORDER BY position ASC, created_at DESC")
    .all() as any[];

  let colors: any[] = [];
  try {
    colors = db.prepare("SELECT id, product_id, name, hex, position, image_url as image FROM product_colors ORDER BY position ASC").all() as any[];
  } catch {
    colors = db.prepare("SELECT id, product_id, name, hex, position FROM product_colors ORDER BY position ASC").all() as any[];
  }
  const variants = db.prepare("SELECT * FROM variants").all() as any[];
  const placements = db
    .prepare(`
      SELECT p.*, a.sha256
      FROM image_placements p
      JOIN assets a ON p.asset_id = a.id
      WHERE p.slot_key = 'product' AND p.active = 1
      ORDER BY p.position ASC
    `)
    .all() as any[];

  const colorsByProd = new Map<string, any[]>();
  for (const c of colors) {
    const list = colorsByProd.get(c.product_id) || [];
    list.push({ id: c.id, name: c.name, hex: c.hex, image: c.image || undefined });
    colorsByProd.set(c.product_id, list);
  }

  const variantsByProd = new Map<string, any[]>();
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

  const imagesByProd = new Map<string, any[]>();
  for (const p of placements) {
    if (!p.owner_id) continue;
    const list = imagesByProd.get(p.owner_id) || [];
    let meta = {};
    try {
      meta = JSON.parse(p.meta || "{}");
    } catch {}
    const sourceUrl = (meta as any).sourceUrl;
    list.push({
      id: p.id,
      url: sourceUrl || `/media/${p.sha256}.webp`,
      thumbUrl: sourceUrl || `/media/${p.sha256}-thumb.webp`,
      alt: p.alt_ar,
      position: p.position,
    });
    imagesByProd.set(p.owner_id, list);
  }

  const result = products.map((p) => {
    let details = {};
    try {
      details = JSON.parse(p.details || "{}");
    } catch {}

    const prodVariants = variantsByProd.get(p.id) || [];
    const isSoldOut =
      p.force_sold_out === 1 || (prodVariants.length > 0 && prodVariants.every((v) => !v.available));

    return {
      id: p.id,
      slug: p.slug,
      name: p.name_ar,
      nameAr: p.name_ar,
      nameEn: p.name_en,
      description: p.description_ar,
      descriptionAr: p.description_ar,
      descriptionEn: p.description_en,
      category: p.category,
      price: Math.round(p.price_cents / 100),
      priceCents: p.price_cents,
      compareAtPrice: p.compare_at_cents ? Math.round(p.compare_at_cents / 100) : null,
      compareAtCents: p.compare_at_cents,
      status: isSoldOut ? "sold_out" : "active",
      forceSoldOut: p.force_sold_out === 1,
      isSoldOut,
      details,
      position: p.position,
      colors: colorsByProd.get(p.id) || [],
      variants: prodVariants,
      images: imagesByProd.get(p.id) || [],
    };
  });

  const latestRev = getLatestRevision("products");
  const payloadString = JSON.stringify(result);
  const etag = `"${crypto.createHash("md5").update(payloadString).digest("hex")}"`;

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return apiSuccess(result, {
    revision: latestRev,
    headers: {
      ETag: etag,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
  } catch (error: any) {
    if (error?.digest?.startsWith?.("NEXT_") || error?.message?.includes?.("bail out")) {
      throw error;
    }
    console.error("Public products route error:", error);
    return apiError("INTERNAL_ERROR", "حدث خطأ في تحميل قائمة المنتجات.", 500);
  }
}
