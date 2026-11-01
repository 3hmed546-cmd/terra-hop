import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb, recordChange, recordAudit } from "@/lib/server/db";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated) return auth.responseError!;

  seedDatabaseIfNeeded();
  const db = getDb();

  const rows = db.prepare("SELECT key, value_ar, value_en, revision FROM site_content").all() as any[];
  const content: Record<string, { ar: string; en: string; revision: number }> = {};

  for (const r of rows) {
    content[r.key] = { ar: r.value_ar, en: r.value_en, revision: r.revision };
  }

  return apiSuccess(content);
}

export async function PATCH(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات المحتوى غير صالحة.", 400);
  }

  const { key, valueAr, valueEn } = body;
  if (!key) {
    return apiError("VALIDATION", "مفتاح المحتوى (key) مطلوب.", 400);
  }

  const db = getDb();
  const existing = db.prepare("SELECT * FROM site_content WHERE key = ?").get(key) as any;
  const nextRev = (existing?.revision || 1) + 1;

  const ar = valueAr !== undefined ? valueAr : (existing?.value_ar || "");
  const en = valueEn !== undefined ? valueEn : (existing?.value_en || "");

  db.prepare(`
    INSERT INTO site_content (key, value_ar, value_en, revision)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value_ar = excluded.value_ar,
      value_en = excluded.value_en,
      revision = excluded.revision
  `).run(key, ar, en, nextRev);

  recordChange("content", "site_content", key, nextRev);
  recordAudit({
    actor: auth.user.email,
    action: "UPDATE_CONTENT",
    entity: "site_content",
    entityId: key,
    before: existing,
    after: { ar, en, nextRev },
  });

  return apiSuccess(
    { updated: true, key, valueAr: ar, valueEn: en },
    { revision: nextRev, topic: "content", topicRevision: nextRev }
  );
}
