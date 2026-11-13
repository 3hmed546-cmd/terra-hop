import { connection } from "next/server";
import { getDb } from "@/lib/server/db";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";

export interface ComingSoonSetting {
  enabled: boolean;
  targetDate: string;
  title?: string;
  imageUrl?: string;
  caption?: string;
}

const DEFAULT_COMING_SOON: ComingSoonSetting = {
  enabled: true,
  targetDate: "2026-11-20T00:00:00",
  title: "TERRA HOP IS COMING SOON",
  imageUrl: "/coming-soon.jpg",
  caption: "",
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
          enabled: parsed.enabled !== undefined ? Boolean(parsed.enabled) : DEFAULT_COMING_SOON.enabled,
          targetDate: parsed.targetDate || DEFAULT_COMING_SOON.targetDate,
          title: parsed.title || DEFAULT_COMING_SOON.title,
          imageUrl: parsed.imageUrl || DEFAULT_COMING_SOON.imageUrl,
          caption: parsed.caption !== undefined ? parsed.caption : DEFAULT_COMING_SOON.caption,
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
