import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb, recordAudit } from "@/lib/server/db";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated) return auth.responseError!;

  seedDatabaseIfNeeded();
  const db = getDb();

  const promos = db.prepare("SELECT * FROM promo_codes ORDER BY starts_at DESC").all() as any[];
  return apiSuccess(promos);
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات كود الخصم غير صالحة.", 400);
  }

  const code = (body.code || "").trim().toUpperCase();
  const kind = body.kind === "fixed" ? "fixed" : "percent";
  const value = Number(body.value) || 0;
  const maxUses = body.maxUses ? Number(body.maxUses) : null;
  const minSubtotalCents = body.minSubtotalCents ? Number(body.minSubtotalCents) : 0;
  const expiresAt = body.expiresAt || null;

  if (!code || value <= 0) {
    return apiError("VALIDATION", "يرجى تحديد الكود وقيمة الخصم بشكل صحيح.", 400);
  }

  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO promo_codes (
      code, kind, value, active, starts_at, expires_at, max_uses, used, min_subtotal_cents
    ) VALUES (?, ?, ?, 1, ?, ?, ?, 0, ?)
    ON CONFLICT(code) DO UPDATE SET
      kind = excluded.kind,
      value = excluded.value,
      expires_at = excluded.expires_at,
      max_uses = excluded.max_uses,
      min_subtotal_cents = excluded.min_subtotal_cents,
      active = 1
  `).run(code, kind, value, now, expiresAt, maxUses, minSubtotalCents);

  recordAudit({
    actor: auth.user.email,
    action: "CREATE_PROMO",
    entity: "promo_codes",
    entityId: code,
    after: { code, kind, value, maxUses, expiresAt },
  });

  return apiSuccess({ created: true, code, kind, value });
}
