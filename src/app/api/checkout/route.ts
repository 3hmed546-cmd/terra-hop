import { NextRequest } from "next/server";
import crypto from "crypto";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getDb, recordChange, recordAudit } from "@/lib/server/db";
import { encryptCustomer } from "@/lib/server/vault";
import { apiSuccess, apiError, type ApiErrorCode } from "@/lib/server/api-envelope";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";
import { getShippingRules, calcShippingCents } from "@/lib/server/shipping";
import { evaluatePromo } from "@/lib/server/promo";
import { normalizePhone, EGYPT_MOBILE } from "@/lib/server/phone";
import { getPaymentHandler } from "@/lib/server/payment";
import type Database from "better-sqlite3";

const CHECKOUT_RATE_OPTIONS = { prefix: "store_checkout", max: 5, windowMs: 10 * 60 * 1000 };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// نص خام نظيف: إزالة الحروف الخفية وقص الطول فقط لمنع التشويه
const cleanText = (v: unknown, max = 500) =>
  typeof v === "string"
    ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max)
    : "";

class CheckoutError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public status = 409,
    public field: string | null = null,
  ) {
    super(message);
  }
}

/** توليد رقم طلب متسلسل TH-1001, TH-1002 */
function nextOrderNumber(db: Database.Database): string {
  db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('order_seq', '1000')").run();
  db.prepare("UPDATE meta SET value = CAST(value AS INTEGER) + 1 WHERE key = 'order_seq'").run();
  const row = db.prepare("SELECT value FROM meta WHERE key = 'order_seq'").get() as { value: string };
  return `TH-${row.value}`;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(ip, CHECKOUT_RATE_OPTIONS);
  if (!rate.success) {
    return apiError(
      "RATE_LIMITED",
      "تم تجاوز الحد المسموح لتسجيل الطلبات. يرجى الانتظار قليلاً ثم المحاولة.",
      429,
      null,
      { "Retry-After": String(rate.retryAfter) },
    );
  }

  seedDatabaseIfNeeded();
  const db = getDb();

  let body: any;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات الطلب غير صالحة.", 400);
  }

  const customer = body?.customer;
  if (!customer || typeof customer !== "object") {
    return apiError("VALIDATION", "بيانات العميل مفقودة.", 400);
  }

  const name = cleanText(customer.name, 120);
  const phone = normalizePhone(cleanText(customer.phone, 30));
  const email = cleanText(customer.email, 160).toLowerCase();
  const city = cleanText(customer.city, 60);
  const address = cleanText(customer.address, 300);
  const notes = cleanText(body?.notes, 500);

  if (name.length < 3) return apiError("VALIDATION", "يرجى إدخال الاسم الثلاثي بالكامل.", 400, "customer.name");
  if (!EGYPT_MOBILE.test(phone)) {
    return apiError("VALIDATION", "يرجى إدخال رقم موبايل مصري صحيح (مثال: 01012345678).", 400, "customer.phone");
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    return apiError("VALIDATION", "صيغة البريد الإلكتروني غير صحيحة.", 400, "customer.email");
  }
  if (!city) return apiError("VALIDATION", "يرجى تحديد المحافظة.", 400, "customer.city");
  if (address.length < 5) {
    return apiError("VALIDATION", "يرجى إدخال العنوان بالتفصيل لتسليم الطلب.", 400, "customer.address");
  }

  const paymentMethod = cleanText(body?.paymentMethod ?? "cod", 20);
  const paymentHandler = getPaymentHandler(paymentMethod);
  if (!paymentHandler || !paymentHandler.isEnabled) {
    return apiError("VALIDATION", "طريقة الدفع غير مدعومة.", 400, "paymentMethod");
  }

  if (!Array.isArray(body?.items) || body.items.length === 0) {
    return apiError("VALIDATION", "سلة المشتريات فارغة.", 400, "items");
  }

  // 1) المنتجات والأسعار من قاعدة البيانات
  let subtotalCents = 0;
  let totalQty = 0;
  const verifiedItems: Array<{
    productId: string;
    productSlug: string;
    productName: string;
    variantId: string;
    colorName: string;
    size: string;
    qty: number;
    priceCents: number;
  }> = [];

  for (const item of body.items) {
    const slug = cleanText(item?.productSlug ?? item?.productId ?? item?.slug, 120);
    if (!slug) return apiError("VALIDATION", "منتج غير صالح في السلة.", 400, "items");
    const size = cleanText(item?.size ?? "L", 10).toUpperCase();
    const qty = Math.max(1, Math.min(10, Math.floor(Number(item?.qty)) || 1));

    const product = db
      .prepare(
        "SELECT id, slug, name_ar, price_cents, force_sold_out FROM products WHERE (id = ? OR slug = ?) AND status = 'active'",
      )
      .get(slug, slug) as any;
    if (!product || product.force_sold_out === 1) {
      return apiError("NOT_FOUND", `المنتج (${slug}) غير متاح حالياً.`, 404, "items");
    }

    const variant = db
      .prepare("SELECT id, size, color_id, stock FROM variants WHERE product_id = ? AND size = ? LIMIT 1")
      .get(product.id, size) as any;
    if (!variant) {
      return apiError("NOT_FOUND", `المقاس المطلوب (${size}) غير متوفر للمنتج ${product.name_ar}.`, 404, "items");
    }

    const colorRow = db
      .prepare("SELECT name FROM product_colors WHERE id = ? AND product_id = ?")
      .get(variant.color_id, product.id) as { name: string } | undefined;

    subtotalCents += product.price_cents * qty;
    totalQty += qty;
    verifiedItems.push({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name_ar,
      variantId: variant.id,
      colorName: colorRow?.name || "اللون الافتراضي",
      size: variant.size,
      qty,
      priceCents: product.price_cents,
    });
  }

  // 2) الشحن والخصم من السيرفر الموحد
  const shippingCents = calcShippingCents(getShippingRules(db), totalQty, subtotalCents);

  let discountCents = 0;
  let appliedPromo: string | null = null;
  const rawPromo = cleanText(body?.promoCode, 40);
  if (rawPromo) {
    const promo = evaluatePromo(db, rawPromo, subtotalCents);
    if (!promo.ok) return apiError("VALIDATION", promo.message, 400, "promoCode");
    appliedPromo = promo.code;
    discountCents = promo.discountCents;
  }

  const totalCents = Math.max(0, subtotalCents - discountCents) + shippingCents;

  // 3) الحفظ وخصم المخزون في transaction واحدة
  const orderId = `ord_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const customerEncrypted = encryptCustomer({ name, phone, email: email || undefined, city, address });
  let orderNumber = "";

  try {
    db.transaction(() => {
      orderNumber = nextOrderNumber(db);

      // فحص المخزون والخصم في خطوة ذرية
      const take = db.prepare("UPDATE variants SET stock = stock - ? WHERE id = ? AND stock >= ?");
      for (const it of verifiedItems) {
        if (take.run(it.qty, it.variantId, it.qty).changes === 0) {
          const left = (db.prepare("SELECT stock FROM variants WHERE id = ?").get(it.variantId) as any)?.stock ?? 0;
          throw new CheckoutError(
            "STOCK_INSUFFICIENT",
            `عذراً، الكمية المتاحة من ${it.productName} (مقاس ${it.size}) هي ${left} فقط.`,
            409,
            "items",
          );
        }
      }

      if (appliedPromo) {
        const r = db
          .prepare(
            "UPDATE promo_codes SET used = used + 1 WHERE code = ? AND (max_uses IS NULL OR max_uses = 0 OR used < max_uses)",
          )
          .run(appliedPromo);
        if (r.changes === 0) {
          throw new CheckoutError("VALIDATION", "تم استنفاد الحد الأقصى لاستخدام كود الخصم.", 409, "promoCode");
        }
      }

      db.prepare(
        `INSERT INTO orders (
           id, number, source, status, customer_enc, notes,
           subtotal_cents, shipping_cents, discount_cents, promo_code, total_cents,
           created_at, revision
         ) VALUES (?, ?, 'website', 'AWAITING_APPROVAL', ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      ).run(
        orderId,
        orderNumber,
        customerEncrypted,
        notes || null,
        subtotalCents,
        shippingCents,
        discountCents,
        appliedPromo,
        totalCents,
        now,
      );

      const insertItem = db.prepare(
        `INSERT INTO order_items (id, order_id, product_id, variant_id, product_name, color_name, size, qty, price_cents_snapshot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const insertMovement = db.prepare(
        `INSERT INTO stock_movements (id, variant_id, product_id, kind, delta, note, order_id, at, by)
         VALUES (?, ?, ?, 'order_reservation', ?, 'حجز تلقائي عند إتمام الطلب', ?, ?, 'system')`,
      );
      for (const it of verifiedItems) {
        insertItem.run(
          `oi_${crypto.randomUUID()}`,
          orderId,
          it.productId,
          it.variantId,
          it.productName,
          it.colorName,
          it.size,
          it.qty,
          it.priceCents,
        );
        insertMovement.run(`mov_${crypto.randomUUID()}`, it.variantId, it.productId, -it.qty, orderId, now);
      }
    })();
  } catch (e) {
    if (e instanceof CheckoutError) return apiError(e.code, e.message, e.status, e.field);
    throw e;
  }

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

  // الرد كامل لصفحة التأكيد
  return apiSuccess(
    {
      id: orderId,
      number: orderNumber,
      status: "AWAITING_APPROVAL",
      createdAt: now,
      currency: "EGP",
      paymentMethod,
      subtotalCents,
      subtotal: Math.round(subtotalCents / 100),
      shippingCents,
      shipping: Math.round(shippingCents / 100),
      discountCents,
      discount: Math.round(discountCents / 100),
      totalCents,
      total: Math.round(totalCents / 100),
      promoCode: appliedPromo,
      customer: { name, phone, email, city, address },
      notes: notes || null,
      items: verifiedItems.map((i) => ({
        productId: i.productId,
        productSlug: i.productSlug,
        productName: i.productName,
        colorName: i.colorName,
        size: i.size,
        qty: i.qty,
        priceCents: i.priceCents,
        priceCentsSnapshot: i.priceCents,
        price: Math.round(i.priceCents / 100),
      })),
    },
    { status: 201 },
  );
}
