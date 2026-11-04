import { NextRequest } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/server/db";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const db = getDb();

  const product = db
    .prepare("SELECT * FROM products WHERE slug = ? AND status = 'active'")
    .get(slug) as any;

  if (!product) {
    return apiError("NOT_FOUND", "المنتج غير موجود أو لم يعد متاحاً.", 404);
  }

  let colors: any[] = [];
  try {
    colors = db
      .prepare("SELECT id, product_id, name, hex, position, image_url as image FROM product_colors WHERE product_id = ? ORDER BY position ASC")
      .all(product.id) as any[];
  } catch {
    colors = db
      .prepare("SELECT id, product_id, name, hex, position FROM product_colors WHERE product_id = ? ORDER BY position ASC")
      .all(product.id) as any[];
  }

  const variants = db
    .prepare("SELECT * FROM variants WHERE product_id = ?")
    .all(product.id) as any[];

  const placements = db
    .prepare(`
      SELECT p.*, a.sha256
      FROM image_placements p
      JOIN assets a ON p.asset_id = a.id
      WHERE p.slot_key = 'product' AND p.owner_id = ? AND p.active = 1
      ORDER BY p.position ASC
    `)
    .all(product.id) as any[];

  const images = placements.map((p) => {
    let meta = {};
    try {
      meta = JSON.parse(p.meta || "{}");
    } catch {}
    const sourceUrl = (meta as any).sourceUrl;
    return {
      id: p.id,
      url: sourceUrl || `/media/${p.sha256}.webp`,
      thumbUrl: sourceUrl || `/media/${p.sha256}-thumb.webp`,
      alt: p.alt_ar,
      position: p.position,
    };
  });

  const formattedVariants = variants.map((v) => ({
    id: v.id,
    colorId: v.color_id,
    size: v.size,
    stock: v.stock ?? 0,
    available: (v.stock ?? 0) > 0,
    stockStatus: (v.stock ?? 0) <= 0 ? "sold_out" : v.stock <= 3 ? "low" : "available",
  }));

  let details = {};
  try {
    details = JSON.parse(product.details || "{}");
  } catch {}

  const isSoldOut = product.force_sold_out === 1 || (formattedVariants.length > 0 && formattedVariants.every((v) => !v.available));

  const result = {
    id: product.id,
    slug: product.slug,
    name: product.name_ar,
    nameAr: product.name_ar,
    nameEn: product.name_en,
    description: product.description_ar,
    descriptionAr: product.description_ar,
    descriptionEn: product.description_en,
    category: product.category,
    price: Math.round(product.price_cents / 100),
    priceCents: product.price_cents,
    compareAtPrice: product.compare_at_cents ? Math.round(product.compare_at_cents / 100) : null,
    compareAtCents: product.compare_at_cents,
    status: isSoldOut ? "sold_out" : "active",
    forceSoldOut: product.force_sold_out === 1,
    details,
    colors: colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex, image: c.image || undefined })),
    variants: formattedVariants,
    images,
  };

  const payloadString = JSON.stringify(result);
  const etag = `"${crypto.createHash("md5").update(payloadString).digest("hex")}"`;

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return apiSuccess(result, {
    revision: product.revision,
    headers: {
      ETag: etag,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
