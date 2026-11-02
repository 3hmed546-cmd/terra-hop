import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb, recordChange, recordAudit } from "@/lib/server/db";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";

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

  const placement = db
    .prepare("SELECT * FROM image_placements WHERE (id = ? OR asset_id = ?) AND slot_key = ?")
    .get(id, id, key) as any;

  if (!placement) {
    return apiSuccess({ deleted: true, id, alreadyDeleted: true });
  }

  const slot = db.prepare("SELECT * FROM image_slots WHERE key = ?").get(key) as any;
  const nextRevision = (slot?.revision || 1) + 1;

  db.transaction(() => {
    db.prepare("DELETE FROM image_placements WHERE id = ?").run(placement.id);
    db.prepare("UPDATE image_slots SET revision = ? WHERE key = ?").run(nextRevision, key);
  })();

  // Protocol B3: Read-back verification - must be gone!
  const checkDeleted = db.prepare("SELECT id FROM image_placements WHERE id = ?").get(placement.id);
  if (checkDeleted) {
    return apiError("WRITE_NOT_VERIFIED", "فشل التحقق من إزالة الصورة من قاعدة البيانات.", 500);
  }

  recordChange("media", "image_placements", id, nextRevision);
  if (key === "product" && placement.owner_id) {
    recordChange("products", "products", placement.owner_id, nextRevision);
  }
  recordAudit({
    actor: auth.user.email,
    action: "DELETE_PLACEMENT",
    entity: "image_placements",
    entityId: id,
    before: placement,
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
