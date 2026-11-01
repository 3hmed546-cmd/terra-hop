import type { Metadata } from "next";
import { Dashboard } from "@/components/admin/dashboard/Dashboard";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";

export const metadata: Metadata = { title: ADMIN_STRINGS.pages.dashboard.title };

export default function Page() {
  return <Dashboard />;
}
