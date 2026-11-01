import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { getDb, recordChange, recordAudit } from "@/lib/server/db";
import { encryptCustomer } from "@/lib/server/vault";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";

const CHECKOUT_RATE_OPTIONS = {
  prefix: "store_checkout",
  max: 5,
  windowMs: 10 * 60 * 1000, // 10 minutes
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(ip, CHECKOUT_RATE_OPTIONS);

  if (!rate.success) {
    return apiError(
      "RATE_LIMITED",
      "تم تجاوز الحد المسموح لتسجيل الطلبات. يرجى الانتظار قليلاً ثم المحاولة.",
      429,
      null,
      { "Retry-After": String(rate.retryAfter) }
    );
  }

  seedDatabaseIfNeeded();
  const db = getDb();

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات الطلب غير صالحة.", 400);
  }

  const { customer, items, notes, promoCode } = body;

  if (!customer || typeof customer !== "object") {
    return apiError("VALIDATION", "بيانات العميل مفقودة.", 400);
  }

  const name = sanitizeText(customer.name ?? "");
  const phone = sanitizeText(customer.phone ?? "");
  const email = sanitizeText(customer.email ?? "");
  const city = sanitizeText(customer.city ?? "");
  const address = sanitizeText(customer.address ?? "");

  if (!name || name.length < 3) {
    return apiError("VALIDATION", "يرجى إدخال الاسم الثلاثي بالكامل.", 400, "customer.name");
  }

  const cleanPhone = phone.replace(/\D/g, "");
  if (!cleanPhone || cleanPhone.length < 10 || cleanPhone.length > 15) {
    return apiError("VALIDATION", "يرجى إدخال رقم هاتف صحيح للتواصل.", 400, "customer.phone");
  }

  if (email && !EMAIL_PATTERN.test(email)) {
    return apiError("VALIDATION", "صيغة البريد الإلكتروني غير صحيحة.", 400, "customer.email");
  }

  if (!city) {
    return apiError("VALIDATION", "يرجى تحديد المحافظة / المدينة.", 400, "customer.city");
  }

  if (!address || address.length < 5) {
    return apiError("VALIDATION", "يرجى إدخال العنوان بالتفصيل لتسليم الطلب.", 400, "customer.address");
  }

  if (!Array.isArray(items) || items.length === 0) {
    return apiError("VALIDATION", "سلة المشتريات فارغة.", 400, "items");
  }

  // 1. Authoritative Server-Side Product & Stock Verification
  let subtotalCents = 0;
  let totalQty = 0;
  const verifiedItems: Array<{
    productId: string;
    productName: string;
    variantId: string;
    colorName: string;
    size: string;
    qty: number;
    priceCents: number;
  }> = [];

  for (const item of items) {
    const qty = Math.max(1, Math.min(10, Number(item.qty) || 1));
    const prodIdOrSlug = item.productId || item.productSlug || item.slug;
    const requestedSize = (item.size || "L").toUpperCase();
    const requestedColorId = item.colorId;

    const product = db
      .prepare(`
        SELECT id, slug, name_ar, price_cents, status, force_sold_out
        FROM products
        WHERE (id = ? OR slug = ?) AND status = 'active'
      `)
      .get(prodIdOrSlug, prodIdOrSlug) as any;

    if (!product || product.force_sold_out === 1) {
      return apiError("NOT_FOUND", `المنتج (${prodIdOrSlug}) غير متاح حالياً.`, 404);
    }

    // Find variant
    let variant: any;
    if (item.variantId) {
      variant = db
        .prepare("SELECT * FROM variants WHERE id = ? AND product_id = ?")
        .get(item.variantId, product.id);
    } else {
      variant = db
        .prepare("SELECT * FROM variants WHERE product_id = ? AND size = ? LIMIT 1")
        .get(product.id, requestedSize);
    }

    if (!variant) {
      return apiError(
        "NOT_FOUND",
        `المقاس المطلوب (${requestedSize}) غير متوفر للمنتج ${product.name_ar}.`,
        404
      );
    }

    if (variant.stock < qty) {
      return apiError(
        "STOCK_INSUFFICIENT",
        `عذراً، الكمية المتاحة من ${product.name_ar} (مقاس ${variant.size}) هي ${variant.stock} فقط.`,
        400
      );
    }

    // Get color name
    const colorRow = db
      .prepare("SELECT name FROM product_colors WHERE id = ? AND product_id = ?")
      .get(variant.color_id, product.id) as { name: string } | undefined;
    const colorName = colorRow?.name || "اللون الافتراضي";

    const itemPriceCents = product.price_cents;
    subtotalCents += itemPriceCents * qty;
    totalQty += qty;

    verifiedItems.push({
      productId: product.id,
      productName: product.name_ar,
      variantId: variant.id,
      colorName,
      size: variant.size,
      qty,
      priceCents: itemPriceCents,
    });
  }

  // 2. Authoritative Shipping Calculation
  const shippingSettingsRow = db
    .prepare("SELECT value FROM settings WHERE group_key = 'shipping' AND key = 'rules'")
    .get() as { value: string } | undefined;

  let shippingRules = { flatRateCents: 5000, freeShippingMinQuantity: 2 };
  if (shippingSettingsRow?.value) {
    try {
      shippingRules = JSON.parse(shippingSettingsRow.value);
    } catch {}
  }

  let shippingCents = shippingRules.flatRateCents || 5000;
  if (totalQty >= (shippingRules.freeShippingMinQuantity || 2)) {
    shippingCents = 0;
  }

  // 3. Authoritative Promo Discount Calculation
  let discountCents = 0;
  let appliedPromoCode: string | null = null;

  if (promoCode) {
    const cleanCode = String(promoCode).trim().toUpperCase();
    const promo = db
      .prepare("SELECT * FROM promo_codes WHERE code = ? AND active = 1")
      .get(cleanCode) as any;

    if (promo) {
      const now = new Date().toISOString();
      const isExpired = promo.expires_at && promo.expires_at < now;
      const isExhausted = promo.max_uses && promo.used >= promo.max_uses;

      if (!isExpired && !isExhausted) {
        appliedPromoCode = promo.code;
        if (promo.kind === "percent") {
          discountCents = Math.round((subtotalCents * promo.value) / 100);
        } else {
          discountCents = Math.min(subtotalCents, promo.value);
        }
      }
    }
  }

  const totalCents = Math.max(0, subtotalCents + shippingCents - discountCents);

  // 4. Create Order & Insert into Database atomically
  const orderId = `ord_${crypto.randomUUID()}`;
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const orderNumber = `TH-${randomSuffix}`;
  const now = new Date().toISOString();

  // Encrypt customer PII (AES-256-GCM)
  const customerEncrypted = encryptCustomer({
    name,
    phone,
    email: email || undefined,
    city,
    address,
  });

  db.transaction(() => {
    // Insert order
    db.prepare(`
      INSERT INTO orders (
        id, number, source, status, customer_enc, notes,
        subtotal_cents, shipping_cents, discount_cents, promo_code, total_cents,
        created_at, revision
      ) VALUES (?, ?, 'website', 'AWAITING_APPROVAL', ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      orderId,
      orderNumber,
      customerEncrypted,
      notes ? sanitizeText(notes) : null,
      subtotalCents,
      shippingCents,
      discountCents,
      appliedPromoCode,
      totalCents,
      now
    );

    // Insert order items & deduct variant stock
    const insertItem = db.prepare(`
      INSERT INTO order_items (
        id, order_id, product_id, variant_id, product_name, color_name, size, qty, price_cents_snapshot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStock = db.prepare(`
      UPDATE variants
      SET stock = stock - ?
      WHERE id = ?
    `);

    const insertMovement = db.prepare(`
      INSERT INTO stock_movements (id, variant_id, product_id, kind, delta, note, order_id, at, by)
      VALUES (?, ?, ?, 'order_reservation', ?, 'حجز تلقائي عند إتمام الطلب', ?, ?, 'system')
    `);

    for (const item of verifiedItems) {
      const oiId = `oi_${crypto.randomUUID()}`;
      insertItem.run(
        oiId,
        orderId,
        item.productId,
        item.variantId,
        item.productName,
        item.colorName,
        item.size,
        item.qty,
        item.priceCents
      );

      // Deduct stock
      updateStock.run(item.qty, item.variantId);

      // Log movement
      insertMovement.run(
        `mov_${crypto.randomUUID()}`,
        item.variantId,
        item.productId,
        -item.qty,
        orderId,
        now
      );
    }

    // Increment promo usage
    if (appliedPromoCode) {
      db.prepare("UPDATE promo_codes SET used = used + 1 WHERE code = ?").run(appliedPromoCode);
    }
  })();

  recordChange("orders", "orders", orderId, 1);
  recordChange("products", "variants", null, Date.now());

  recordAudit({
    actor: "customer",
    action: "CREATE_ORDER",
    entity: "orders",
    entityId: orderId,
    ip,
    after: { orderNumber, totalCents, itemsCount: verifiedItems.length },
  });

  return apiSuccess({
    id: orderId,
    number: orderNumber,
    subtotal: Math.round(subtotalCents / 100),
    subtotalCents,
    shipping: Math.round(shippingCents / 100),
    shippingCents,
    discount: Math.round(discountCents / 100),
    discountCents,
    total: Math.round(totalCents / 100),
    totalCents,
    currency: "EGP",
    status: "AWAITING_APPROVAL",
    createdAt: now,
  });
}
