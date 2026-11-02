import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getDb } from "@/lib/server/db";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";
import { lookupAndValidateCode } from "@/lib/server/ambassadors/codes";

const PROMO_RATE_OPTIONS = {
  prefix: "promo_validate",
  max: 12,
  windowMs: 5 * 60 * 1000,
};

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(ip, PROMO_RATE_OPTIONS);

  if (!rate.success) {
    return NextResponse.json(
      {
        ok: false,
        valid: false,
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
    const rawCode = String(body.code ?? "").trim();

    if (!rawCode) {
      return NextResponse.json({ ok: false, valid: false, error: "يرجى إدخال كود الخصم" }, { status: 400 });
    }

    seedDatabaseIfNeeded();
    const db = getDb();

    const subtotalCents = Math.max(0, Math.floor(Number(body.subtotalCents) || 0));
    const items = Array.isArray(body.items) ? body.items : [];
    const customerContext = {
      phone: body.phone ? String(body.phone).trim() : undefined,
      email: body.email ? String(body.email).trim() : undefined,
    };

    const result = lookupAndValidateCode(db, rawCode, items, subtotalCents, customerContext);

    if (!result.ok) {
      return NextResponse.json({ ok: false, valid: false, error: result.message }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      valid: true,
      code: result.code,
      kind: result.kind,
      discountCents: result.discountCents,
      discountPercent: result.discountPercent,
      message: result.message,
      voucherId: result.kind === "voucher" ? result.voucherId : undefined,
      ambassadorId: result.kind === "ambassador" ? result.ambassadorId : undefined,
      referralCodeId: result.kind === "ambassador" ? result.referralCodeId : undefined,
    });
  } catch {
    return NextResponse.json({ ok: false, valid: false, error: "طلب غير صالح" }, { status: 400 });
  }
}
