import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb, recordAudit } from "@/lib/server/db";
import { getUploadsDir } from "@/lib/server/services/assets";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  const { id } = await context.params;
  const db = getDb();

  const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as any;
  if (!asset) {
    return apiError("NOT_FOUND", "ملف الصورة غير موجود.", 404);
  }

  const placements = db
    .prepare("SELECT slot_key, owner_id FROM image_placements WHERE asset_id = ?")
    .all(id) as any[];

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";

  if (placements.length > 0 && !force) {
    const slotsUsed = Array.from(new Set(placements.map((p) => p.slot_key))).join(", ");
    return apiError(
      "IN_USE",
      `لا يمكن حذف الصورة لأنها مستخدمة حالياً في الأقسام التالية: (${slotsUsed}). استخدم ?force=true للحذف الإجباري.`,
      409
    );
  }

  // Delete from DB and disk
  db.transaction(() => {
    if (placements.length > 0) {
      db.prepare("DELETE FROM image_placements WHERE asset_id = ?").run(id);
    }
    db.prepare("DELETE FROM assets WHERE id = ?").run(id);
  })();

  const uploadsDir = getUploadsDir();
  const fileVariations = [
    `${asset.sha256}.webp`,
    `${asset.sha256}-md.webp`,
    `${asset.sha256}-thumb.webp`,
  ];

  for (const filename of fileVariations) {
    const p = path.join(uploadsDir, filename);
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch {
        // Ignore unlinking errors if file was already removed
      }
    }
  }

  recordAudit({
    actor: auth.user.email,
    action: "DELETE_ASSET",
    entity: "assets",
    entityId: id,
    before: asset,
  });

  return apiSuccess({ deleted: true, id });
}
