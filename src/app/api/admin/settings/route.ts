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

  const rows = db.prepare("SELECT group_key, key, value, updated_at FROM settings").all() as any[];
  const settings: Record<string, any> = {};

  for (const r of rows) {
    if (!settings[r.group_key]) settings[r.group_key] = {};
    try {
      settings[r.group_key][r.key] = JSON.parse(r.value);
    } catch {
      settings[r.group_key][r.key] = r.value;
    }
  }

  return apiSuccess(settings);
}

export async function PATCH(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات الإعدادات غير صالحة.", 400);
  }

  const { groupKey, key, value } = body;
  if (!groupKey || !key || value === undefined) {
    return apiError("VALIDATION", "المجموعة (groupKey) والمفتاح (key) والقيمة (value) مطلوبة.", 400);
  }

  const db = getDb();
  const now = new Date().toISOString();
  const stringValue = typeof value === "string" ? value : JSON.stringify(value);

  db.prepare(`
    INSERT INTO settings (group_key, key, value, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(group_key, key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `).run(groupKey, key, stringValue, now, auth.user.email);

  const nextRevision = recordChange("settings", "settings", `${groupKey}:${key}`, Date.now());
  recordAudit({
    actor: auth.user.email,
    action: "UPDATE_SETTINGS",
    entity: "settings",
    entityId: `${groupKey}:${key}`,
    after: value,
  });

  return apiSuccess(
    { updated: true, groupKey, key, value },
    { revision: nextRevision, topic: "settings", topicRevision: nextRevision }
  );
}
