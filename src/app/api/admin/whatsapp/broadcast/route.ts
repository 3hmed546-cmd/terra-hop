import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb } from "@/lib/server/db";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import {
  broadcastNewProductToConfirmedCustomers,
  getWhatsAppBotStatus,
} from "@/lib/server/services/whatsapp-bot";
import {
  getConfirmedCustomersCount,
  getConfirmedCustomers,
} from "@/lib/server/confirmed-customers";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  const db = getDb();
  const count = getConfirmedCustomersCount(db);
  const customers = getConfirmedCustomers(db);

  // Get active products for dropdown selection
  const products = db
    .prepare(`
      SELECT id, slug, name_ar, price_cents, compare_at_cents, description_ar
      FROM products
      WHERE status = 'active'
      ORDER BY position ASC, created_at DESC
    `)
    .all() as any[];

  const colors = db
    .prepare("SELECT product_id, name, image_url as image FROM product_colors ORDER BY position ASC")
    .all() as any[];

  const variants = db
    .prepare("SELECT product_id, size FROM variants")
    .all() as any[];

  const placements = db
    .prepare(`
      SELECT p.owner_id, p.meta, a.sha256
      FROM image_placements p
      JOIN assets a ON p.asset_id = a.id
      WHERE p.slot_key = 'product'
      ORDER BY p.position ASC
    `)
    .all() as any[];

  const formattedProducts = products.map((p) => {
    const prodColors = colors.filter((c) => c.product_id === p.id);
    const prodVariants = variants.filter((v) => v.product_id === p.id);
    const prodPlacements = placements.filter((pl) => pl.owner_id === p.id);

    let firstImage: string | undefined = undefined;
    if (prodPlacements.length > 0) {
      try {
        const meta = JSON.parse(prodPlacements[0].meta || "{}");
        firstImage = meta.sourceUrl || `/media/${prodPlacements[0].sha256}.webp`;
      } catch {
        firstImage = `/media/${prodPlacements[0].sha256}.webp`;
      }
    }
    if (!firstImage && prodColors.find((c) => c.image)) {
      firstImage = prodColors.find((c) => c.image)?.image;
    }

    return {
      id: p.id,
      slug: p.slug,
      nameAr: p.name_ar,
      priceCents: p.price_cents,
      compareAtCents: p.compare_at_cents,
      descriptionAr: p.description_ar,
      colors: Array.from(new Set(prodColors.map((c) => c.name).filter(Boolean))),
      sizes: Array.from(new Set(prodVariants.map((v) => v.size).filter(Boolean))),
      imageUrl: firstImage,
    };
  });

  return apiSuccess({
    confirmedCustomersCount: count,
    recentCustomers: customers.slice(0, 15).map((c) => ({
      id: c.id,
      name: c.name,
      maskedPhone: c.phone ? `${c.phone.slice(0, 3)}****${c.phone.slice(-4)}` : "****",
      ordersCount: c.ordersCount,
      totalSpentCents: c.totalSpentCents,
      lastOrderNumber: c.lastOrderNumber,
      lastOrderAt: c.lastOrderAt,
    })),
    products: formattedProducts,
    botConnected: getWhatsAppBotStatus().status === "CONNECTED",
  });
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات البث غير صالحة.", 400);
  }

  const { productId, customNote } = body;
  if (!productId) {
    return apiError("VALIDATION", "يرجى اختيار المنتج المراد إرسال إشعاره للعملاء.", 400);
  }

  const db = getDb();
  const product = db
    .prepare("SELECT * FROM products WHERE id = ? OR slug = ?")
    .get(productId, productId) as any;

  if (!product) {
    return apiError("NOT_FOUND", "المنتج المطلوب غير موجود.", 404);
  }

  const prodColors = db
    .prepare("SELECT name, image_url as image FROM product_colors WHERE product_id = ? ORDER BY position ASC")
    .all(product.id) as any[];

  const prodVariants = db
    .prepare("SELECT size FROM variants WHERE product_id = ?")
    .all(product.id) as any[];

  const placements = db
    .prepare(`
      SELECT p.meta, a.sha256
      FROM image_placements p
      JOIN assets a ON p.asset_id = a.id
      WHERE p.slot_key = 'product' AND p.owner_id = ?
      ORDER BY p.position ASC
    `)
    .all(product.id) as any[];

  let firstImage: string | undefined = undefined;
  if (placements.length > 0) {
    try {
      const meta = JSON.parse(placements[0].meta || "{}");
      firstImage = meta.sourceUrl || `/media/${placements[0].sha256}.webp`;
    } catch {
      firstImage = `/media/${placements[0].sha256}.webp`;
    }
  }
  if (!firstImage && prodColors.find((c) => c.image)) {
    firstImage = prodColors.find((c) => c.image)?.image;
  }

  const formattedProduct = {
    id: product.id,
    slug: product.slug,
    nameAr: product.name_ar,
    priceCents: product.price_cents,
    compareAtCents: product.compare_at_cents,
    descriptionAr: product.description_ar,
    colors: Array.from(new Set(prodColors.map((c) => c.name).filter(Boolean))),
    sizes: Array.from(new Set(prodVariants.map((v) => v.size).filter(Boolean))),
    imageUrl: firstImage,
  };

  try {
    const result = await broadcastNewProductToConfirmedCustomers({
      product: formattedProduct,
      customNote: typeof customNote === "string" ? customNote.trim() : undefined,
    });

    return apiSuccess({
      message: `تم إرسال إشعار المنتج الجديد إلى ${result.sent} عميل مؤكد بنجاح!`,
      ...result,
    });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", err?.message || "فشل إرسال البث عبر الواتساب.", 500);
  }
}
