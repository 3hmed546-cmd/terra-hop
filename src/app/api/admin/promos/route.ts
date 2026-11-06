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

  const rows = db.prepare("SELECT * FROM promo_codes ORDER BY starts_at DESC").all() as any[];

  // Fetch all scoped products
  let scopedRows: { promo_code: string; product_id: string }[] = [];
  try {
    scopedRows = db.prepare("SELECT promo_code, product_id FROM promo_code_products").all() as any[];
  } catch {}

  const productsByCode = new Map<string, string[]>();
  for (const r of scopedRows) {
    const list = productsByCode.get(r.promo_code) || [];
    list.push(r.product_id);
    productsByCode.set(r.promo_code, list);
  }

  // Fetch all active products for the picker and metadata
  const allProducts = db
    .prepare("SELECT id, name_ar as name, slug, price_cents as priceCents, category FROM products WHERE status = 'active' ORDER BY position ASC")
    .all() as any[];

  const items = rows.map((p) => {
    const productIds = productsByCode.get(p.code) || [];
    return {
      code: p.code,
      kind: p.kind || "percent",
      value: p.value,
      active: p.active === 1,
      startsAt: p.starts_at,
      expiresAt: p.expires_at,
      maxUses: p.max_uses,
      used: p.used || 0,
      minSubtotalCents: p.min_subtotal_cents || 0,
      appliesTo: p.applies_to || "ALL_PRODUCTS",
      selectedProductIds: productIds,
    };
  });

  const overview = {
    totalCodes: items.length,
    activeCodes: items.filter((it) => it.active).length,
    totalUses: items.reduce((sum, it) => sum + (it.used || 0), 0),
  };

  return apiSuccess({ items, overview, products: allProducts });
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

  const code = (body.code || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const kind = body.kind === "fixed" ? "fixed" : "percent";
  const value = Number(body.value) || 0;
  const maxUses = body.maxUses ? Number(body.maxUses) : null;
  const minSubtotalCents = body.minSubtotalCents ? Number(body.minSubtotalCents) : 0;
  const expiresAt = body.expiresAt || null;
  const appliesTo = body.appliesTo === "SELECTED" ? "SELECTED" : "ALL_PRODUCTS";
  const eligibleProductIds: string[] = Array.isArray(body.eligibleProductIds) ? body.eligibleProductIds : [];

  if (!code || code.length < 3) {
    return apiError("VALIDATION", "يرجى إدخال كود خصم صحيح (3 أحرف أو أرقام على الأقل).", 400);
  }

  if (value <= 0) {
    return apiError("VALIDATION", "يرجى تحديد قيمة خصم صحيحة أكبر من صفر.", 400);
  }

  if (kind === "percent" && value > 100) {
    return apiError("VALIDATION", "النسبة المئوية للخصم لا يمكن أن تتجاوز 100%.", 400);
  }

  if (appliesTo === "SELECTED" && eligibleProductIds.length === 0) {
    return apiError("VALIDATION", "يرجى اختيار منتج واحد على الأقل مشمول في كود الخصم.", 400);
  }

  seedDatabaseIfNeeded();
  const db = getDb();

  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(`
      INSERT INTO promo_codes (
        code, kind, value, active, starts_at, expires_at, max_uses, used, min_subtotal_cents, applies_to
      ) VALUES (?, ?, ?, 1, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(code) DO UPDATE SET
        kind = excluded.kind,
        value = excluded.value,
        expires_at = excluded.expires_at,
        max_uses = excluded.max_uses,
        min_subtotal_cents = excluded.min_subtotal_cents,
        applies_to = excluded.applies_to,
        active = 1
    `).run(code, kind, value, now, expiresAt, maxUses, minSubtotalCents, appliesTo);

    try {
      db.prepare("DELETE FROM promo_code_products WHERE promo_code = ?").run(code);
      if (appliesTo === "SELECTED" && eligibleProductIds.length > 0) {
        const insertProd = db.prepare(
          "INSERT OR IGNORE INTO promo_code_products (promo_code, product_id) VALUES (?, ?)"
        );
        for (const pId of eligibleProductIds) {
          insertProd.run(code, pId);
        }
      }
    } catch {}
  })();

  recordAudit({
    actor: auth.user.email,
    action: "CREATE_PROMO",
    entity: "promo_codes",
    entityId: code,
    after: { code, kind, value, maxUses, expiresAt, appliesTo, eligibleProductIds },
  });

  return apiSuccess({ created: true, code, kind, value, appliesTo });
}
