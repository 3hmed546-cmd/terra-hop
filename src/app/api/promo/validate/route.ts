import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sanitizeText, verifySameOrigin } from "@/lib/sanitize";

// Rate Limit on Promo Validation: Prevent brute-forcing discount codes
const PROMO_RATE_OPTIONS = {
  prefix: "promo_validate",
  max: 8, // max 8 tries per 5 minutes
  windowMs: 5 * 60 * 1000,
};

function getPromoCodesFromEnv(): Map<string, number> {
  const codesMap = new Map<string, number>();
  const rawCodes = process.env.PROMO_CODES || "TERRA10:10,VIP20:20,WELCOME50:50,DROP01:15";

  for (const pair of rawCodes.split(",")) {
    const [code, discount] = pair.split(":");
    if (code && discount) {
      const cleanCode = code.trim().toUpperCase();
      const cleanDiscount = Math.min(100, Math.max(1, Number(discount.trim()) || 0));
      if (cleanDiscount > 0) {
        codesMap.set(cleanCode, cleanDiscount);
      }
    }
  }

  return codesMap;
}

export async function POST(request: Request) {
  // 1. Origin verification
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "طلب غير مصرح به" }, { status: 403 });
  }

  // 2. Rate limiting & DoS protection
  const ip = getClientIp(request);
  const rate = checkRateLimit(ip, PROMO_RATE_OPTIONS);

  if (!rate.success) {
    const isHardBlock = rate.retryAfter > 600;
    return NextResponse.json(
      {
        error: isHardBlock
          ? "تم حظر هذا العنوان مؤقتاً لمدة 30 دقيقة بسبب تكرار المحاولات المريبة."
          : "محاولات كثيرة جداً لكتابة أكواد الخصم. يرجى الانتظار قليلاً.",
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
    const rawCode = sanitizeText(String(body.code || "")).trim().toUpperCase();

    if (!rawCode) {
      return NextResponse.json({ error: "يُرجى إدخال كود الخصم" }, { status: 400 });
    }

    const availableCodes = getPromoCodesFromEnv();
    const discountPercent = availableCodes.get(rawCode);

    if (discountPercent === undefined) {
      return NextResponse.json(
        {
          ok: false,
          error: "كود الخصم غير صحيح أو انتهت صلاحيته.",
          remaining: rate.remaining,
        },
        {
          status: 404,
          headers: {
            "X-RateLimit-Limit": String(rate.limit),
            "X-RateLimit-Remaining": String(rate.remaining),
          },
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        code: rawCode,
        discountPercent,
        message: `تم تطبيق كود الخصم بنجاح! خصم بقيمة ${discountPercent}%.`,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
}
