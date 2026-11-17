import type { Metadata } from "next";
import { ManagersManager } from "@/components/admin/settings/ManagersManager";

export const metadata: Metadata = {
  title: "مسؤولين المتجر وسجل العمليات | لوحة تحكم TERRA HOP",
};

export default function ManagersPage() {
  return (
    <div className="adm-page p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <ManagersManager />
    </div>
  );
}
