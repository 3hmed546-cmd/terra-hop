import { NextRequest } from "next/server";
import crypto from "crypto";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb, recordChange, recordAudit } from "@/lib/server/db";
import { processAndSaveAsset, removeAssetIfUnused } from "@/lib/server/services/assets";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { syncGalleryVault, syncProductsVault } from "@/lib/server/vault-sync";

export async function POST(
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

  let assetId: string | null = null;
  let altAr = "";
  let altEn = "";
  let meta: any = {};
  let ownerId: string | null = null;
  let position: number | null = null;

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    if (file && file instanceof Blob) {
      const originalName = file instanceof File ? file.name : "upload.webp";
      const buffer = Buffer.from(await file.arrayBuffer());
      const asset = await processAndSaveAsset(buffer, originalName, auth.user.email);
      assetId = asset.id;
    } else {
      assetId = (formData.get("assetId") as string) || null;
    }
    altAr = (formData.get("altAr") as string) || "";
    altEn = (formData.get("altEn") as string) || "";
    ownerId = (formData.get("ownerId") as string) || null;
    const metaRaw = formData.get("meta");
    if (typeof metaRaw === "string") {
      try {
        meta = JSON.parse(metaRaw);
      } catch {}
    }
  } else {
    try {
      const body = await request.json();
      assetId = body.assetId || null;
      altAr = body.altAr || "";
      altEn = body.altEn || "";
      meta = body.meta || {};
      ownerId = body.ownerId || null;
      if (typeof body.position === "number") position = body.position;
    } catch {
      return apiError("VALIDATION", "بيانات إضافة الصورة غير صالحة.", 400);
    }
  }

  if (!assetId) {
    return apiError("VALIDATION", "معرف ملف الصورة (assetId) أو ملف الصورة مطلوب.", 400, "assetId");
  }

  const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(assetId) as any;
  if (!asset) {
    return apiError("NOT_FOUND", "ملف الصورة المحدد غير موجود في مكتبة الملفات.", 404);
  }

  // Calculate next position if not specified
  if (position === null) {
    const maxPosRow = db
      .prepare(`
        SELECT MAX(position) as max_pos
        FROM image_placements
        WHERE slot_key = ? AND (owner_id = ? OR (owner_id IS NULL AND ? IS NULL))
      `)
      .get(key, ownerId, ownerId) as { max_pos: number | null };
    position = (maxPosRow?.max_pos ?? 0) + 1;
  }

  const placementId = `plc_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const nextRevision = (slot.revision || 1) + 1;

  // Insert inside transaction
  db.transaction(() => {
    db.prepare(`
      INSERT INTO image_placements (
        id, slot_key, owner_id, asset_id, position, alt_ar, alt_en, meta, active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      placementId,
      key,
      ownerId,
      assetId,
      position,
      altAr || asset.original_name || "",
      altEn || asset.original_name || "",
      JSON.stringify(meta),
      now
    );

    db.prepare("UPDATE image_slots SET revision = ? WHERE key = ?").run(nextRevision, key);
  })();

  // Protocol B3: Read-back verification
  const readBack = db
    .prepare("SELECT * FROM image_placements WHERE id = ?")
    .get(placementId) as any;

  if (!readBack) {
    return apiError("WRITE_NOT_VERIFIED", "فشل تأكيد حفظ الصورة في قاعدة البيانات.", 500);
  }

  // Persist additions to file vault
  if (key === "hero_carousel" || key === "hero_banner" || key === "login_showcase") {
    syncGalleryVault(db);
  } else if (key === "product") {
    syncProductsVault(db);
  }

  recordChange("media", "image_placements", placementId, nextRevision);
  recordAudit({
    actor: auth.user.email,
    action: "ADD_PLACEMENT",
    entity: "image_placements",
    entityId: placementId,
    after: readBack,
  });

  const sourceUrl = meta.sourceUrl;
  const itemUrl = sourceUrl || `/media/${asset.sha256}.webp`;
  const thumbUrl = sourceUrl || `/media/${asset.sha256}-thumb.webp`;

  return apiSuccess(
    {
      id: readBack.id,
      slotKey: readBack.slot_key,
      ownerId: readBack.owner_id,
      assetId: readBack.asset_id,
      position: readBack.position,
      altAr: readBack.alt_ar,
      altEn: readBack.alt_en,
      active: readBack.active === 1,
      meta,
      url: itemUrl,
      thumbUrl,
      width: asset.width,
      height: asset.height,
      createdAt: readBack.created_at,
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

  if (slot.required === 1) {
    return apiError("IN_USE", "لا يمكن حذف جميع صور هذا القسم لأنه قسم إجباري للمتجر (مثل اللوجو).", 409);
  }

  const url = new URL(request.url);
  const confirmParam = url.searchParams.get("confirm");
  const ownerId = url.searchParams.get("owner");

  if (confirmParam !== key) {
    return apiError("VALIDATION", `لحذف جميع صور هذا القسم، يجب تمرير ?confirm=${key}.`, 400);
  }

  const nextRevision = (slot.revision || 1) + 1;
  let deletedCount = 0;
  const assetsToCheck = db
    .prepare(`SELECT asset_id FROM image_placements WHERE slot_key = ?${ownerId ? " AND owner_id = ?" : ""}`)
    .all(...(ownerId ? [key, ownerId] : [key])) as Array<{ asset_id: string }>;

  db.transaction(() => {
    let delQuery = "DELETE FROM image_placements WHERE slot_key = ?";
    const params: any[] = [key];
    if (ownerId) {
      delQuery += " AND owner_id = ?";
      params.push(ownerId);
    }
    const res = db.prepare(delQuery).run(...params);
    deletedCount = res.changes;

    db.prepare("UPDATE image_slots SET revision = ? WHERE key = ?").run(nextRevision, key);
  })();

  // The placement is gone now, so only remove the file when no other page or
  // product still references it.
  for (const asset of assetsToCheck) removeAssetIfUnused(asset.asset_id);

  if (key === "hero_carousel" || key === "hero_banner" || key === "login_showcase") {
    syncGalleryVault(db);
  } else if (key === "product") {
    syncProductsVault(db);
  }

  recordChange("media", "image_slots", key, nextRevision);
  recordAudit({
    actor: auth.user.email,
    action: "CLEAR_SLOT",
    entity: "image_slots",
    entityId: key,
    after: { deletedCount, nextRevision },
  });

  return apiSuccess(
    { cleared: true, deletedCount },
    {
      revision: nextRevision,
      topic: "media",
      topicRevision: nextRevision,
    }
  );
}
