import { connection } from "next/server";
import { getDb } from "@/lib/server/db";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";

export interface ComingSoonSetting {
  enabled: boolean;
  targetDate: string;
  title?: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  caption?: string;
  hasProducts?: boolean;
}

const DEFAULT_COMING_SOON: ComingSoonSetting = {
  enabled: false,
  targetDate: "2026-11-20T00:00:00",
  title: "TERRA HOP IS COMING SOON",
  imageUrl: "/coming-soon-desktop.jpg",
  mobileImageUrl: "/coming-soon-mobile.jpg",
  caption: "",
  hasProducts: true,
};

export function getComingSoonSettingSync(): ComingSoonSetting {
  try {
    const db = getDb();

    let hasProducts = false;
    try {
      const prodRow = db
        .prepare("SELECT COUNT(*) as count FROM products WHERE status != 'archived' AND status != 'draft'")
        .get() as any;
      hasProducts = Boolean(prodRow && prodRow.count > 0);
    } catch {}

    const row = db
      .prepare("SELECT value FROM settings WHERE group_key = 'store' AND key = 'coming_soon'")
      .get() as any;

    if (row && row.value) {
      try {
        const parsed = JSON.parse(row.value);
        const isExplicitlyEnabled = parsed.enabled !== undefined ? Boolean(parsed.enabled) : false;
        return {
          enabled: !hasProducts && isExplicitlyEnabled,
          hasProducts,
          targetDate: parsed.targetDate || DEFAULT_COMING_SOON.targetDate,
          title: parsed.title || DEFAULT_COMING_SOON.title,
          imageUrl: parsed.imageUrl || DEFAULT_COMING_SOON.imageUrl,
          mobileImageUrl: parsed.mobileImageUrl || DEFAULT_COMING_SOON.mobileImageUrl,
          caption: parsed.caption !== undefined ? parsed.caption : DEFAULT_COMING_SOON.caption,
        };
      } catch {
        // malformed JSON fallback
      }
    }

    return {
      ...DEFAULT_COMING_SOON,
      enabled: !hasProducts,
      hasProducts,
    };
  } catch {
    // If running in isolation or database is momentarily locked
  }

  return DEFAULT_COMING_SOON;
}

export async function getComingSoonSettingServer(): Promise<ComingSoonSetting> {
  return getComingSoonSettingSync();
}
