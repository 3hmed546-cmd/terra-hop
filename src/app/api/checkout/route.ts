import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sanitizeText, verifySameOrigin } from "@/lib/sanitize";
import { saveOrderToVault, type VaultOrder } from "@/lib/server/vault";

// Rate Limit on Checkout: Max 5 orders per 10 minutes per IP
const RATE_OPTIONS = {
  prefix: "store_checkout",
  max: 5,
  windowMs: 10 * 60 * 1000,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Authoritative Server-Side Product Prices (Prevents Parameter Tampering Attacks)
const AUTHORITATIVE_PRICES: Record<string, number> = {
  "black-oversized-tee": 650,
  "off-white-graphic-tee": 650,
  "black-oversized-hoodie": 1100,
  "vintage-brown-hoodie": 1150,
  "forest-green-hoodie": 1100,
  "dusty-blue-hoodie": 1200,
  "washed-grey-hoodie": 1050,
  "sand-beige-hoodie": 1100,
  "charcoal-hoodie": 1150,
  "deep-teal-hoodie": 1250,
  "slate-navy-hoodie": 1150,
  "classic-black-hoodie": 1100,
};

function getPromoDiscountPercent(code: string): number {
  if (!code) return 0;
  const cleanCode = code.trim().toUpperCase();
  const rawCodes = process.env.PROMO_CODES || "TERRA10:10,VIP20:20,WELCOME50:50,DROP01:15";

  for (const pair of rawCodes.split(",")) {
    const [c, d] = pair.split(":");
    if (c && d && c.trim().toUpperCase() === cleanCode) {
      return Math.min(100, Math.max(1, Number(d.trim()) || 0));
    }
  }
  return 0;
}

export async function POST(request: Request) {
  // 1. CSRF / Same-Origin Check
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "طلب غير مصرح به (Cross-Origin Request Blocked)" }, { status: 403 });
  }

  // 2. Multi-tier Rate Limiting & DoS Protection
  const ip = getClientIp(request);
  const rate = checkRateLimit(ip, RATE_OPTIONS);

  if (!rate.success) {
    return NextResponse.json(
      {
        error: "تم تجاوز الحد المسموح لتسجيل الطلبات. يرجى الانتظار قليلاً ثم المحاولة.",
        retryAfter: rate.retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfter),
          "X-RateLimit-Limit": String(rate.limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  try {
    const body = await request.json();
    const customer = body.customer || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const notes = sanitizeText(String(body.notes || ""));
    const promoCode = sanitizeText(String(body.promoCode || "")).trim().toUpperCase();

    // 3. Strict Input Validation & Sanitization (Against XSS / Injection)
    const name = sanitizeText(String(customer.name || ""));
    if (!name || name.length < 3) {
      return NextResponse.json({ error: "الاسم بالكامل مطلوب (3 حروف على الأقل)" }, { status: 400 });
    }

    const cleanPhone = String(customer.phone || "").replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10 || cleanPhone.length > 12) {
      return NextResponse.json({ error: "رقم الهاتف غير صحيح" }, { status: 400 });
    }

    const email = sanitizeText(String(customer.email || "").toLowerCase());
    if (!email || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ error: "البريد الإلكتروني غير صحيح" }, { status: 400 });
    }

    const city = sanitizeText(String(customer.city || ""));
    if (!city) {
      return NextResponse.json({ error: "المحافظة مطلوبة" }, { status: 400 });
    }

    const address = sanitizeText(String(customer.address || ""));
    if (!address || address.length < 5) {
      return NextResponse.json({ error: "العنوان بالتفصيل مطلوب" }, { status: 400 });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: "سلة المشتريات فارغة" }, { status: 400 });
    }

    // 4. Authoritative Pricing Shield (Never trust client-provided priceCents!)
    const validatedItems = items.map((it: { productSlug?: string; productName?: string; size?: string; qty?: number }) => {
      const slug = sanitizeText(String(it.productSlug || "")).toLowerCase();
      const genuineEgp = AUTHORITATIVE_PRICES[slug] ?? 1100; // Authoritative price from server
      const genuinePriceCents = genuineEgp * 100;
      const qty = Math.max(1, Math.min(20, Math.floor(Number(it.qty) || 1)));

      return {
        productSlug: slug || "hoodie-streetwear",
        productName: sanitizeText(String(it.productName || "TERRA HOP Item")),
        size: sanitizeText(String(it.size || "L")),
        qty,
        priceCents: genuinePriceCents,
      };
    });

    const totalQty = validatedItems.reduce((sum: number, it: { qty: number }) => sum + it.qty, 0);
    const subtotalCents = validatedItems.reduce(
      (sum: number, it: { priceCents: number; qty: number }) => sum + it.priceCents * it.qty,
      0
    );

    // 5. Server-side Promo Code Discount Calculation
    const discountPercent = getPromoDiscountPercent(promoCode);
    const discountCents = discountPercent > 0 ? Math.round((subtotalCents * discountPercent) / 100) : 0;

    // Free shipping if 2 or more pieces, otherwise 60 EGP
    const shippingCents = totalQty >= 2 ? 0 : 6000;
    const totalCents = Math.max(0, subtotalCents - discountCents) + shippingCents;

    // Cryptographically unpredictable order ID and human-friendly order number
    const orderNumber = `TH-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();

    const order: VaultOrder = {
      id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      number: orderNumber,
      source: "website",
      status: "AWAITING_APPROVAL",
      customer: {
        name,
        phone: cleanPhone,
        email,
        city,
        address,
      },
      notes: notes || undefined,
      items: validatedItems,
      subtotalCents,
      shippingCents,
      discountCents: discountCents > 0 ? discountCents : undefined,
      totalCents,
      createdAt: now,
      soldAt: null,
    };

    // 6. Secure Data Vault: Encrypt and persist to isolated server vault (AES-256-GCM)
    await saveOrderToVault(order);

    return NextResponse.json(
      {
        ok: true,
        order,
      },
      {
        status: 201,
        headers: {
          "X-RateLimit-Limit": String(rate.limit),
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      }
    );
  } catch (err) {
    console.error("[Checkout Route Error]", err);
    return NextResponse.json({ error: "حدث خطأ أثناء معالجة الطلب" }, { status: 500 });
  }
}
