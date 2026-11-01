import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";

export async function GET() {
  seedDatabaseIfNeeded();
  const db = getDb();

  const placements = db
    .prepare(`
      SELECT p.*, a.sha256
      FROM image_placements p
      JOIN assets a ON p.asset_id = a.id
      WHERE p.slot_key = 'hero_carousel' AND p.active = 1
      ORDER BY p.position ASC
    `)
    .all() as any[];

  const images = placements.map((p) => {
    let meta = {};
    try {
      meta = JSON.parse(p.meta || "{}");
    } catch {}
    const sourceUrl = (meta as any).sourceUrl;
    return {
      id: p.id,
      title: p.alt_ar || "صورة هيدر",
      src: sourceUrl || `/media/${p.sha256}.webp`,
      category: "header",
      tag: "هيدر كاروسيل",
      addedAt: (p.created_at || "").split("T")[0],
    };
  });

  return NextResponse.json({ ok: true, images });
}

export async function POST() {
  // Legacy media mutation endpoint now disabled in favor of /api/admin/slots/*
  return NextResponse.json({ ok: true, message: "Use /api/admin/slots endpoints." });
}
