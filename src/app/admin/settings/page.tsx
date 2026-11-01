import type { Metadata } from "next";
import { SettingsPage } from "@/components/admin/settings/SettingsPage";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";

export const metadata: Metadata = { title: ADMIN_STRINGS.pages.settings.title };

export default function Page() {
  return <SettingsPage />;
}
