import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb, recordChange, recordAudit } from "@/lib/server/db";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { syncGalleryVault, syncProductsVault } from "@/lib/server/vault-sync";
import { removeAssetIfUnused } from "@/lib/server/services/assets";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ key: string; id: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  const { key, id } = await context.params;
  const db = getDb();

  const placement = db
    .prepare("SELECT * FROM image_placements WHERE id = ? AND slot_key = ?")
    .get(id, key) as any;

  if (!placement) {
    return apiError("NOT_FOUND", "عنصر الصورة غير موجود في هذا القسم.", 404);
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات التعديل غير صالحة.", 400);
  }

  let existingMeta = {};
  try {
    existingMeta = JSON.parse(placement.meta || "{}");
  } catch {}

  const mergedMeta = body.meta ? { ...existingMeta, ...body.meta } : existingMeta;
  const altAr = typeof body.altAr === "string" ? body.altAr : placement.alt_ar;
  const altEn = typeof body.altEn === "string" ? body.altEn : placement.alt_en;
  const active = typeof body.active === "boolean" ? (body.active ? 1 : 0) : placement.active;

  const slot = db.prepare("SELECT revision FROM image_slots WHERE key = ?").get(key) as any;
  const nextRevision = (slot?.revision || 1) + 1;

  db.transaction(() => {
    db.prepare(`
      UPDATE image_placements
      SET alt_ar = ?, alt_en = ?, meta = ?, active = ?
      WHERE id = ?
    `).run(altAr, altEn, JSON.stringify(mergedMeta), active, id);

    db.prepare("UPDATE image_slots SET revision = ? WHERE key = ?").run(nextRevision, key);
  })();

  const readBack = db.prepare("SELECT * FROM image_placements WHERE id = ?").get(id) as any;
  if (!readBack) {
    return apiError("WRITE_NOT_VERIFIED", "فشل التحقق من حفظ التعديلات.", 500);
  }

  recordChange("media", "image_placements", id, nextRevision);
  if (key === "product" && placement.owner_id) {
    recordChange("products", "products", placement.owner_id, nextRevision);
  }
  recordAudit({
    actor: auth.user.email,
    action: "UPDATE_PLACEMENT",
    entity: "image_placements",
    entityId: id,
    before: placement,
    after: readBack,
  });

  if (key === "hero_carousel" || key === "hero_banner" || key === "login_showcase") {
    syncGalleryVault(db);
  } else if (key === "product") {
    syncProductsVault(db);
  }

  return apiSuccess(
    {
      ...readBack,
      active: readBack.active === 1,
      meta: mergedMeta,
    },
    {
      revision: nextRevision,
      topic: "media",
      topicRevision: nextRevision,
    }
  );
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ key: string; id: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  const { key, id } = await context.params;
  const db = getDb();

  const placement = db.prepare("SELECT * FROM image_placements WHERE id = ? AND slot_key = ?").get(id, key) as any;
  const placements = placement ? [placement] : [];

  if (placements.length === 0) {
    if (key === "hero_carousel" || key === "hero_banner" || key === "login_showcase") {
      syncGalleryVault(db);
    }
    return apiSuccess({ deleted: true, id, alreadyDeleted: true });
  }

  const slot = db.prepare("SELECT * FROM image_slots WHERE key = ?").get(key) as any;
  const nextRevision = (slot?.revision || 1) + 1;

  db.transaction(() => {
    for (const p of placements) {
      db.prepare("DELETE FROM image_placements WHERE id = ?").run(p.id);
    }
    db.prepare("UPDATE image_slots SET revision = ? WHERE key = ?").run(nextRevision, key);
  })();

  for (const p of placements) removeAssetIfUnused(p.asset_id);

  // Protocol B3: Read-back verification - must be gone!
  for (const p of placements) {
    const checkDeleted = db.prepare("SELECT id FROM image_placements WHERE id = ?").get(p.id);
    if (checkDeleted) {
      return apiError("WRITE_NOT_VERIFIED", "فشل التحقق من إزالة الصورة من قاعدة البيانات.", 500);
    }
  }

  // Persist deletion to file vault so it never reappears on reload
  if (key === "hero_carousel" || key === "hero_banner" || key === "login_showcase") {
    syncGalleryVault(db);
  } else if (key === "product") {
    syncProductsVault(db);
  }

  recordChange("media", "image_placements", id, nextRevision);
  for (const p of placements) {
    if (key === "product" && p.owner_id) {
      recordChange("products", "products", p.owner_id, nextRevision);
    }
  }
  recordAudit({
    actor: auth.user.email,
    action: "DELETE_PLACEMENT",
    entity: "image_placements",
    entityId: id,
    before: placements[0],
    after: null,
  });

  return apiSuccess(
    { deleted: true, id },
    {
      revision: nextRevision,
      topic: "media",
      topicRevision: nextRevision,
    }
  );
}
