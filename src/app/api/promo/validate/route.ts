import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getDb } from "@/lib/server/db";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";

const PROMO_RATE_OPTIONS = {
  prefix: "promo_validate",
  max: 8,
  windowMs: 5 * 60 * 1000,
};

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(ip, PROMO_RATE_OPTIONS);

  if (!rate.success) {
    return NextResponse.json(
      {
        error: "محاولات كثيرة جداً لكتابة أكواد الخصم. يرجى الانتظار قليلاً.",
        retryAfter: rate.retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfter),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const rawCode = String(body.code ?? "").trim().toUpperCase();

    if (!rawCode) {
      return NextResponse.json({ error: "يرجى إدخال كود الخصم" }, { status: 400 });
    }

    seedDatabaseIfNeeded();
    const db = getDb();

    const promo = db
      .prepare(`
        SELECT *
        FROM promo_codes
        WHERE code = ? AND active = 1
      `)
      .get(rawCode) as any;

    if (promo) {
      const now = new Date().toISOString();
      if (promo.expires_at && promo.expires_at < now) {
        return NextResponse.json({ valid: false, error: "كود الخصم منتهي الصلاحية" }, { status: 400 });
      }
      if (promo.max_uses && promo.used >= promo.max_uses) {
        return NextResponse.json({ valid: false, error: "تم استنفاد الحد الأقصى لاستخدام هذا الكود" }, { status: 400 });
      }

      return NextResponse.json({
        valid: true,
        code: promo.code,
        kind: promo.kind,
        discount: promo.kind === "percent" ? promo.value : Math.round(promo.value / 100),
        discountPercent: promo.kind === "percent" ? promo.value : undefined,
        discountCents: promo.kind === "fixed" ? promo.value : undefined,
        minSubtotalCents: promo.min_subtotal_cents,
      });
    }

    return NextResponse.json(
      { valid: false, error: "كود الخصم غير صحيح أو غير متاح حالياً" },
      { status: 404 }
    );
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
}
