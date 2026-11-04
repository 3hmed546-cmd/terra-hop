import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb, getLatestRevision } from "@/lib/server/db";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";

export async function GET(request: NextRequest) {
  try {
    seedDatabaseIfNeeded();
    const db = getDb();

    // 1. Settings
    const settingsRows = db.prepare("SELECT group_key, key, value FROM settings").all() as any[];
    const settings: Record<string, any> = {};
    for (const s of settingsRows) {
      if (!settings[s.group_key]) settings[s.group_key] = {};
      try {
        settings[s.group_key][s.key] = JSON.parse(s.value);
      } catch {
        settings[s.group_key][s.key] = s.value;
      }
    }

    // 2. Site Content
    const contentRows = db.prepare("SELECT key, value_ar, value_en FROM site_content").all() as any[];
    const content: Record<string, { ar: string; en: string }> = {};
    for (const c of contentRows) {
      content[c.key] = { ar: c.value_ar, en: c.value_en };
    }

    // 3. Active Placements grouped by Slot
    const placements = db
      .prepare(`
        SELECT 
          p.id,
          p.slot_key,
          p.owner_id,
          p.position,
          p.alt_ar,
          p.alt_en,
          p.meta,
          a.sha256,
          a.width,
          a.height
        FROM image_placements p
        JOIN assets a ON p.asset_id = a.id
        WHERE p.active = 1
        ORDER BY p.slot_key, p.position ASC
      `)
      .all() as any[];

    const slots: Record<string, any[]> = {};
    for (const p of placements) {
      if (!slots[p.slot_key]) slots[p.slot_key] = [];
      let meta = {};
      try {
        meta = JSON.parse(p.meta || "{}");
      } catch {}

      const sourceUrl = (meta as any).sourceUrl;
      const url = sourceUrl || `/media/${p.sha256}.webp`;
      const thumbUrl = sourceUrl || `/media/${p.sha256}-thumb.webp`;

      slots[p.slot_key].push({
        id: p.id,
        ownerId: p.owner_id,
        position: p.position,
        alt: { ar: p.alt_ar, en: p.alt_en },
        url,
        thumbUrl,
        width: p.width,
        height: p.height,
        meta,
      });
    }

    const latestRev = getLatestRevision();
    const payload = {
      settings,
      content,
      slots,
      version: latestRev,
    };

    const payloadString = JSON.stringify(payload);
    const etag = `"${crypto.createHash("md5").update(payloadString).digest("hex")}"`;

    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    return apiSuccess(payload, {
      revision: latestRev,
      headers: {
        ETag: etag,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (error: any) {
    if (error?.digest?.startsWith?.("NEXT_") || error?.message?.includes?.("bail out")) {
      throw error;
    }
    console.error("Public site route error:", error);
    return apiError("INTERNAL_ERROR", "حدث خطأ في تحميل بيانات الموقع.", 500);
  }
}
