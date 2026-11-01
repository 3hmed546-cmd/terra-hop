import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb } from "@/lib/server/db";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth.authenticated) return auth.responseError!;

  const { key } = await context.params;
  const db = getDb();

  const slot = db.prepare("SELECT * FROM image_slots WHERE key = ?").get(key) as any;
  if (!slot) {
    return apiError("NOT_FOUND", `قسم الصور (${key}) غير موجود.`, 404);
  }

  const url = new URL(request.url);
  const ownerId = url.searchParams.get("owner");

  let query = `
    SELECT 
      p.*,
      a.sha256,
      a.mime,
      a.width,
      a.height,
      a.bytes,
      a.original_name
    FROM image_placements p
    JOIN assets a ON p.asset_id = a.id
    WHERE p.slot_key = ?
  `;
  const params: any[] = [key];

  if (ownerId) {
    query += " AND p.owner_id = ?";
    params.push(ownerId);
  } else if (slot.key === "product") {
    // If querying product slot without owner, return all or filtered
  } else {
    query += " AND (p.owner_id IS NULL OR p.owner_id = '')";
  }

  query += " ORDER BY p.position ASC";

  const placements = db.prepare(query).all(...params) as any[];

  const items = placements.map((p) => {
    let metaParsed = {};
    try {
      metaParsed = JSON.parse(p.meta || "{}");
    } catch {}

    const sourceUrl = (metaParsed as any).sourceUrl;
    const itemUrl = sourceUrl || `/media/${p.sha256}.webp`;
    const thumbUrl = sourceUrl || `/media/${p.sha256}-thumb.webp`;

    return {
      id: p.id,
      slotKey: p.slot_key,
      ownerId: p.owner_id,
      assetId: p.asset_id,
      position: p.position,
      altAr: p.alt_ar,
      altEn: p.alt_en,
      active: p.active === 1,
      meta: metaParsed,
      url: itemUrl,
      thumbUrl,
      width: p.width,
      height: p.height,
      createdAt: p.created_at,
    };
  });

  return apiSuccess({
    key: slot.key,
    labelAr: slot.label_ar,
    kind: slot.kind,
    minItems: slot.min_items,
    maxItems: slot.max_items,
    aspect: slot.aspect,
    required: slot.required === 1,
    revision: slot.revision,
    items,
  });
}
