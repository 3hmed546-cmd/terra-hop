import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb, recordChange, recordAudit } from "@/lib/server/db";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { syncGalleryVault, syncProductsVault } from "@/lib/server/vault-sync";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  const { key } = await context.params;
  const db = getDb();

  const slot = db.prepare("SELECT * FROM image_slots WHERE key = ?").get(key) as any;
  if (!slot) {
    return apiError("NOT_FOUND", `قسم الصور (${key}) غير موجود.`, 404);
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات إعادة الترتيب غير صالحة.", 400);
  }

  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
  const ownerId: string | null = body.ownerId || null;
  const ifRevision: number | undefined = typeof body.ifRevision === "number" ? body.ifRevision : undefined;

  if (ifRevision !== undefined && slot.revision !== ifRevision) {
    return apiError(
      "REVISION_CONFLICT",
      "تم تعديل هذا القسم من قبل مستخدم آخر، يرجى تحديث الصفحة والمحاولة مجدداً.",
      409
    );
  }

  if (ids.length === 0) {
    return apiError("VALIDATION", "قائمة معرفات الصور (ids) فارغة.", 400);
  }

  const nextRevision = (slot.revision || 1) + 1;

  db.transaction(() => {
    const updateStmt = db.prepare(`
      UPDATE image_placements
      SET position = ?
      WHERE (id = ? OR asset_id = ?) AND slot_key = ?
    `);

    ids.forEach((id, index) => {
      updateStmt.run(index + 1, id, id, key);
    });

    db.prepare("UPDATE image_slots SET revision = ? WHERE key = ?").run(nextRevision, key);
  })();

  if (key === "hero_carousel" || key === "hero_banner" || key === "login_showcase") {
    syncGalleryVault(db);
  } else if (key === "product") {
    syncProductsVault(db);
  }

  recordChange("media", "image_slots", key, nextRevision);
  if (key === "product" && ownerId) {
    recordChange("products", "products", ownerId, nextRevision);
  }
  recordAudit({
    actor: auth.user.email,
    action: "REORDER_SLOT",
    entity: "image_slots",
    entityId: key,
    after: { ids, nextRevision },
  });

  return apiSuccess(
    { reordered: true, ids },
    {
      revision: nextRevision,
      topic: "media",
      topicRevision: nextRevision,
    }
  );
}
