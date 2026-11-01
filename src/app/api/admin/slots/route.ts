import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb } from "@/lib/server/db";
import { apiSuccess } from "@/lib/server/api-envelope";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated) return auth.responseError!;

  seedDatabaseIfNeeded();
  const db = getDb();

  const slots = db.prepare("SELECT * FROM image_slots ORDER BY key ASC").all() as any[];
  const placements = db
    .prepare(`
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
      ORDER BY p.slot_key, p.position ASC
    `)
    .all() as any[];

  const placementsBySlot = new Map<string, any[]>();
  for (const p of placements) {
    const list = placementsBySlot.get(p.slot_key) || [];
    let metaParsed = {};
    try {
      metaParsed = JSON.parse(p.meta || "{}");
    } catch {}

    const sourceUrl = (metaParsed as any).sourceUrl;
    const url = sourceUrl || `/media/${p.sha256}.webp`;
    const thumbUrl = sourceUrl || `/media/${p.sha256}-thumb.webp`;

    list.push({
      id: p.id,
      slotKey: p.slot_key,
      ownerId: p.owner_id,
      assetId: p.asset_id,
      position: p.position,
      altAr: p.alt_ar,
      altEn: p.alt_en,
      active: p.active === 1,
      meta: metaParsed,
      url,
      thumbUrl,
      width: p.width,
      height: p.height,
      createdAt: p.created_at,
    });
    placementsBySlot.set(p.slot_key, list);
  }

  const result = slots.map((s) => ({
    key: s.key,
    labelAr: s.label_ar,
    kind: s.kind,
    minItems: s.min_items,
    maxItems: s.max_items,
    aspect: s.aspect,
    required: s.required === 1,
    revision: s.revision,
    items: placementsBySlot.get(s.key) || [],
  }));

  return apiSuccess(result);
}
