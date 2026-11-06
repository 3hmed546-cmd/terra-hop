import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb, recordAudit } from "@/lib/server/db";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode || "").trim().toUpperCase();

  const db = getDb();

  const existing = db.prepare("SELECT * FROM promo_codes WHERE code = ?").get(code) as any;
  if (!existing) {
    return apiError("NOT_FOUND", "كود الخصم غير موجود.", 404);
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات التحديث غير صالحة.", 400);
  }

  const active = typeof body.active === "boolean" ? (body.active ? 1 : 0) : existing.active;

  db.prepare("UPDATE promo_codes SET active = ? WHERE code = ?").run(active, code);

  recordAudit({
    actor: auth.user.email,
    action: "UPDATE_PROMO_STATUS",
    entity: "promo_codes",
    entityId: code,
    after: { active },
  });

  return apiSuccess({ updated: true, code, active: active === 1 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode || "").trim().toUpperCase();

  const db = getDb();

  const existing = db.prepare("SELECT * FROM promo_codes WHERE code = ?").get(code) as any;
  if (!existing) {
    return apiError("NOT_FOUND", "كود الخصم غير موجود.", 404);
  }

  db.transaction(() => {
    try {
      db.prepare("DELETE FROM promo_code_products WHERE promo_code = ?").run(code);
    } catch {}
    try {
      db.prepare("DELETE FROM promo_redemptions WHERE code = ?").run(code);
    } catch {}
    db.prepare("DELETE FROM promo_codes WHERE code = ?").run(code);
  }).immediate();

  recordAudit({
    actor: auth.user.email,
    action: "DELETE_PROMO",
    entity: "promo_codes",
    entityId: code,
    before: existing,
  });

  return apiSuccess({ deleted: true, code });
}
