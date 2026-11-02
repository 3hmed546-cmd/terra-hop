import type Database from "better-sqlite3";

export type PromoResult =
  | { ok: true; code: string; kind: "percent" | "fixed"; discountCents: number; discountPercent?: number }
  | { ok: false; status: number; message: string };

export function evaluatePromo(db: Database.Database, rawCode: string, subtotalCents: number): PromoResult {
  const code = rawCode.trim().toUpperCase();
  const p = db.prepare("SELECT * FROM promo_codes WHERE code = ? AND active = 1").get(code) as any;
  if (!p) return { ok: false, status: 404, message: "كود الخصم غير صحيح أو غير متاح حالياً" };

  const now = new Date().toISOString();
  if (p.starts_at && p.starts_at > now) return { ok: false, status: 400, message: "كود الخصم لم يبدأ بعد" };
  if (p.expires_at && p.expires_at < now) return { ok: false, status: 400, message: "كود الخصم منتهي الصلاحية" };
  if (p.max_uses && p.used >= p.max_uses) return { ok: false, status: 400, message: "تم استنفاد الحد الأقصى لاستخدام هذا الكود" };
  if (subtotalCents > 0 && subtotalCents < (p.min_subtotal_cents ?? 0)) {
    return { ok: false, status: 400, message: "قيمة الطلب أقل من الحد الأدنى لاستخدام هذا الكود" };
  }

  const discountCents =
    p.kind === "percent"
      ? Math.round((subtotalCents * p.value) / 100)
      : Math.min(subtotalCents > 0 ? subtotalCents : p.value, p.value);

  return {
    ok: true,
    code: p.code,
    kind: p.kind,
    discountCents,
    discountPercent: p.kind === "percent" ? p.value : undefined,
  };
}
