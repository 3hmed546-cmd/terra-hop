import { NextRequest } from "next/server";
import crypto from "crypto";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb, recordChange, recordAudit } from "@/lib/server/db";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated) return auth.responseError!;

  seedDatabaseIfNeeded();
  const db = getDb();

  const products = db.prepare("SELECT * FROM products ORDER BY position ASC, created_at DESC").all() as any[];
  const colors = db.prepare("SELECT * FROM product_colors ORDER BY position ASC").all() as any[];
  const variants = db.prepare("SELECT * FROM variants").all() as any[];
  const placements = db
    .prepare(`
      SELECT p.*, a.sha256
      FROM image_placements p
      JOIN assets a ON p.asset_id = a.id
      WHERE p.slot_key = 'product'
      ORDER BY p.position ASC
    `)
    .all() as any[];

  const colorsByProd = new Map<string, any[]>();
  for (const c of colors) {
    const list = colorsByProd.get(c.product_id) || [];
    list.push({ id: c.id, name: c.name, hex: c.hex });
    colorsByProd.set(c.product_id, list);
  }

  const variantsByProd = new Map<string, any[]>();
  for (const v of variants) {
    const list = variantsByProd.get(v.product_id) || [];
    list.push({ id: v.id, colorId: v.color_id, size: v.size, stock: v.stock });
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
    const totalStock = prodVariants.reduce((sum, v) => sum + (v.stock || 0), 0);

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
      priceCents: p.price_cents,
      compareAtCents: p.compare_at_cents,
      status: p.status,
      forceSoldOut: p.force_sold_out === 1,
      lowStockThreshold: p.low_stock_threshold,
      details,
      position: p.position,
      revision: p.revision,
      colors: colorsByProd.get(p.id) || [],
      variants: prodVariants,
      images: imagesByProd.get(p.id) || [],
      totalStock,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  });

  return apiSuccess(result);
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات إنشاء المنتج غير صالحة.", 400);
  }

  const nameAr = (body.nameAr || body.name || "").trim();
  const nameEn = (body.nameEn || "").trim();
  const priceCents = Number(body.priceCents) || 0;
  const compareAtCents = body.compareAtCents ? Number(body.compareAtCents) : null;
  const category = (body.category || "hoodie").trim();
  const descriptionAr = (body.descriptionAr || body.description || "").trim();
  const descriptionEn = (body.descriptionEn || "").trim();

  if (!nameAr || priceCents <= 0) {
    return apiError("VALIDATION", "يرجى إدخال اسم المنتج وسعر صحيح أكبر من صفر.", 400);
  }

  // Generate unique slug
  let baseSlug = (body.slug || nameEn || nameAr)
    .toLowerCase()
    .replace(/[^\w\u0621-\u064A-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!baseSlug) baseSlug = `product-${Date.now()}`;

  const db = getDb();
  let slug = baseSlug;
  let counter = 1;
  while (db.prepare("SELECT id FROM products WHERE slug = ?").get(slug)) {
    slug = `${baseSlug}-${counter++}`;
  }

  const prodId = `prod_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  // Get max position
  const maxPos = (db.prepare("SELECT MAX(position) as p FROM products").get() as any)?.p ?? 0;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO products (
        id, slug, name_ar, name_en, description_ar, description_en,
        category, price_cents, compare_at_cents, status, force_sold_out,
        details, position, revision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, 1, ?, ?)
    `).run(
      prodId,
      slug,
      nameAr,
      nameEn,
      descriptionAr,
      descriptionEn,
      category,
      priceCents,
      compareAtCents,
      JSON.stringify(body.details || {}),
      maxPos + 1,
      now,
      now
    );

    // Default color if provided
    const colors = Array.isArray(body.colors) && body.colors.length > 0
      ? body.colors
      : [{ id: "default", name: "اللون الافتراضي", hex: "#000000" }];

    const insertColor = db.prepare(`
      INSERT INTO product_colors (id, product_id, name, hex, position)
      VALUES (?, ?, ?, ?, ?)
    `);
    colors.forEach((c: any, idx: number) => {
      insertColor.run(c.id, prodId, c.name, c.hex, idx + 1);
    });

    // Default sizes & variants
    const sizes = Array.isArray(body.sizes) && body.sizes.length > 0
      ? body.sizes
      : ["S", "M", "L", "XL", "XXL"];

    const insertVariant = db.prepare(`
      INSERT INTO variants (id, product_id, color_id, size, stock)
      VALUES (?, ?, ?, ?, ?)
    `);

    colors.forEach((c: any) => {
      sizes.forEach((s: string) => {
        const vId = `var_${crypto.randomUUID()}`;
        insertVariant.run(vId, prodId, c.id, s, 10);
      });
    });
  })();

  recordChange("products", "products", prodId, 1);
  recordAudit({
    actor: auth.user.email,
    action: "CREATE_PRODUCT",
    entity: "products",
    entityId: prodId,
    after: { prodId, slug, nameAr, priceCents },
  });

  return apiSuccess(
    { id: prodId, slug, nameAr, priceCents },
    { revision: 1, topic: "products", topicRevision: 1 }
  );
}
