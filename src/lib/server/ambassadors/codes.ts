import type Database from "better-sqlite3";
import { hashLookupCode, encryptCode, decryptCode } from "../security";
import { normalizePhone } from "../phone";

export interface CodeValidationItem {
  productId: string;
  productSlug?: string;
  qty: number;
  priceCents: number;
}

export type CodeValidationResult =
  | {
      ok: true;
      kind: "ambassador" | "voucher" | "promo";
      code: string;
      discountPercent?: number;
      discountCents: number;
      message: string;
      ambassadorId?: string;
      referralCodeId?: string;
      voucherId?: string;
      appliesTo?: "ALL_PRODUCTS" | "SELECTED";
      eligibleProductIds?: string[];
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

/**
 * Validates any customer entered code:
 * 1. Encrypted single-use reward vouchers (AES-256-GCM / SHA-256 hash lookup)
 * 2. Encrypted Ambassador referral codes with product scoping & owner-set %
 * 3. Fallback to standard promo codes
 */
export function lookupAndValidateCode(
  db: Database.Database,
  rawCode: string,
  cartItems: CodeValidationItem[] = [],
  subtotalCents: number = 0,
  customerContext?: { phone?: string; email?: string }
): CodeValidationResult {
  const normalized = (rawCode || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (!normalized || normalized.length < 3) {
    return { ok: false, message: "يرجى إدخال كود صحيح.", status: 400 };
  }

  const codeHash = hashLookupCode(normalized);
  const now = new Date().toISOString();

  // -------------------------------------------------------------------------
  // 1. Check Reward Vouchers (e.g. 80% off hoodie)
  // -------------------------------------------------------------------------
  const voucher = db
    .prepare(
      `SELECT rv.*, a.status as amb_status 
       FROM reward_vouchers rv
       JOIN ambassadors a ON rv.ambassador_id = a.id
       WHERE rv.code_hash = ? AND rv.status = 'ACTIVE'`
    )
    .get(codeHash) as any;

  if (voucher) {
    if (voucher.expires_at && voucher.expires_at < now) {
      return { ok: false, message: "كود الخصم منتهي الصلاحية.", status: 400 };
    }

    // Verify cryptographic integrity
    const decryptedCode = decryptCode(voucher.encrypted_code);
    if (!decryptedCode || decryptedCode.toUpperCase() !== normalized) {
      return { ok: false, message: "رمز الكود غير صالح.", status: 400 };
    }

    // Voucher is 80% discount on 1 hoodie item
    let eligibleItems = cartItems;
    if (voucher.eligible_category) {
      // Find eligible items (all hoodies in catalog)
      eligibleItems = cartItems.filter((i) => {
        const prod = db.prepare("SELECT category FROM products WHERE id = ? OR slug = ?").get(i.productId, i.productId) as any;
        return !prod || prod.category?.toLowerCase() === voucher.eligible_category.toLowerCase();
      });
    }

    if (eligibleItems.length === 0) {
      return {
        ok: false,
        message: "هذا الكود مخصص لقطع الهوديز فقط، يرجى إضافة هودي إلى سلة المشتريات.",
        status: 400,
      };
    }

    // Apply 80% to single item with highest value
    const targetItem = [...eligibleItems].sort((a, b) => b.priceCents - a.priceCents)[0];
    const discountPercent = voucher.discount_percent || 80;
    let discountCents = Math.round((targetItem.priceCents * discountPercent) / 100);
    if (voucher.max_discount_cents && discountCents > voucher.max_discount_cents) {
      discountCents = voucher.max_discount_cents;
    }

    return {
      ok: true,
      kind: "voucher",
      code: normalized,
      voucherId: voucher.id,
      ambassadorId: voucher.ambassador_id,
      discountPercent,
      discountCents,
      message: `تم تفعيل كود مكافأة السفير: خصم ${discountPercent}% على الهودي.`,
    };
  }

  // -------------------------------------------------------------------------
  // 2. Check Ambassador Referral Codes
  // -------------------------------------------------------------------------
  const refCode = db
    .prepare(
      `SELECT rc.*, a.status as amb_status, a.display_name, a.phone as amb_phone, a.email as amb_email
       FROM referral_codes rc
       JOIN ambassadors a ON rc.ambassador_id = a.id
       WHERE rc.code_hash = ? AND rc.is_active = 1`
    )
    .get(codeHash) as any;

  if (refCode) {
    if (refCode.amb_status !== "ACTIVE") {
      return { ok: false, message: "كود الخصم غير متاح حالياً.", status: 400 };
    }
    if (refCode.valid_from && refCode.valid_from > now) {
      return { ok: false, message: "كود الخصم لم يبدأ تفعيله بعد.", status: 400 };
    }
    if (refCode.valid_until && refCode.valid_until < now) {
      return { ok: false, message: "انتهى هذا العرض، ترقب عروضنا قريباً", status: 400 };
    }
    if (refCode.max_uses && refCode.used_count >= refCode.max_uses) {
      return { ok: false, message: "انتهى هذا العرض، ترقب عروضنا قريباً", status: 400 };
    }

    // Self-referral prevention (Ambassador cannot buy using their own code)
    if (customerContext?.phone && refCode.amb_phone) {
      const custPhone = normalizePhone(customerContext.phone);
      const ambPhone = normalizePhone(refCode.amb_phone);
      if (custPhone && ambPhone && custPhone === ambPhone) {
        return { ok: false, message: "لا يمكن استخدام كود السفير الخاص بك في طلباتك الشخصية.", status: 400 };
      }
    }
    if (customerContext?.email && refCode.amb_email) {
      if (customerContext.email.trim().toLowerCase() === refCode.amb_email.trim().toLowerCase()) {
        return { ok: false, message: "لا يمكن استخدام كود السفير الخاص بك في طلباتك الشخصية.", status: 400 };
      }
    }

    // Verify cryptographic integrity
    const decryptedCode = decryptCode(refCode.encrypted_code);
    if (!decryptedCode || decryptedCode.toUpperCase() !== normalized) {
      return { ok: false, message: "رمز كود الخصم غير صالح.", status: 400 };
    }

    // Product Scoping (Owner Decision R2)
    let eligibleSubtotalCents = 0;
    let eligibleProductIds: string[] = [];

    if (refCode.applies_to === "SELECTED") {
      const allowedRows = db
        .prepare("SELECT product_id FROM discount_code_products WHERE code_id = ?")
        .all(refCode.id) as { product_id: string }[];
      eligibleProductIds = allowedRows.map((r) => r.product_id);

      // Filter cart items matching eligible products
      for (const item of cartItems) {
        const prod = db
          .prepare("SELECT id, slug FROM products WHERE id = ? OR slug = ?")
          .get(item.productId || item.productSlug, item.productSlug || item.productId) as any;
        const matches =
          (prod && (eligibleProductIds.includes(prod.id) || eligibleProductIds.includes(prod.slug))) ||
          (item.productId && eligibleProductIds.includes(item.productId)) ||
          (item.productSlug && eligibleProductIds.includes(item.productSlug));

        if (matches) {
          eligibleSubtotalCents += item.priceCents * item.qty;
        }
      }

      if (cartItems.length > 0 && eligibleSubtotalCents === 0) {
        return {
          ok: false,
          message: "هذا الكود غير مخصص للمنتجات الموجودة في سلتك.",
          status: 400,
        };
      }
    } else {
      eligibleSubtotalCents = subtotalCents > 0 ? subtotalCents : cartItems.reduce((acc, it) => acc + it.priceCents * it.qty, 0);
    }

    const discountPercent = refCode.discount_percent;
    const discountCents = Math.round((eligibleSubtotalCents * discountPercent) / 100);

    return {
      ok: true,
      kind: "ambassador",
      code: normalized,
      ambassadorId: refCode.ambassador_id,
      referralCodeId: refCode.id,
      discountPercent,
      discountCents,
      appliesTo: refCode.applies_to,
      eligibleProductIds,
      message: `تم تطبيق خصم السفير بنجاح بنسبة ${discountPercent}% على المنتجات المؤهلة.`,
    };
  }

  // -------------------------------------------------------------------------
  // 3. Fallback to Legacy promo_codes Table
  // -------------------------------------------------------------------------
  const p = db.prepare("SELECT * FROM promo_codes WHERE code = ? AND active = 1").get(normalized) as any;
  if (p) {
    if (p.starts_at && p.starts_at > now) return { ok: false, message: "كود الخصم لم يبدأ بعد.", status: 400 };
    if (p.expires_at && p.expires_at < now) return { ok: false, message: "انتهى هذا العرض، ترقب عروضنا قريباً", status: 400 };
    if (p.max_uses && p.used >= p.max_uses) return { ok: false, message: "انتهى هذا العرض، ترقب عروضنا قريباً", status: 400 };
    if (subtotalCents > 0 && subtotalCents < (p.min_subtotal_cents ?? 0)) {
      return { ok: false, message: "قيمة الطلب أقل من الحد الأدنى لاستخدام هذا الكود.", status: 400 };
    }

    const discountCents =
      p.kind === "percent"
        ? Math.round((subtotalCents * p.value) / 100)
        : Math.min(subtotalCents > 0 ? subtotalCents : p.value, p.value);

    return {
      ok: true,
      kind: "promo",
      code: p.code,
      discountCents,
      discountPercent: p.kind === "percent" ? p.value : undefined,
      message: p.kind === "percent" ? `تم تطبيق خصم ${p.value}% بنجاح.` : `تم تطبيق خصم ${Math.round(discountCents / 100)} ج.م بنجاح.`,
    };
  }

  return { ok: false, message: "كود الخصم غير صحيح أو غير متاح حالياً.", status: 404 };
}
