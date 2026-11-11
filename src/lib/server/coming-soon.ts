import { connection } from "next/server";
import { getDb } from "@/lib/server/db";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";

export interface ComingSoonSetting {
  enabled: boolean;
  targetDate: string;
  title?: string;
}

const DEFAULT_COMING_SOON: ComingSoonSetting = {
  enabled: false,
  targetDate: "2026-11-20T00:00:00",
  title: "TERRA HOP IS COMING SOON",
};

export async function getComingSoonSettingServer(): Promise<ComingSoonSetting> {
  try {
    await connection();
    seedDatabaseIfNeeded();
    const db = getDb();
    const row = db
      .prepare("SELECT value FROM settings WHERE group_key = 'store' AND key = 'coming_soon'")
      .get() as any;

    if (row && row.value) {
      try {
        const parsed = JSON.parse(row.value);
        return {
          enabled: Boolean(parsed.enabled),
          targetDate: parsed.targetDate || DEFAULT_COMING_SOON.targetDate,
          title: parsed.title || DEFAULT_COMING_SOON.title,
        };
      } catch {
        // malformed JSON fallback
      }
    }
  } catch {
    // If running in isolation or database is momentarily locked
  }

  return DEFAULT_COMING_SOON;
}
