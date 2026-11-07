import type { Metadata } from "next";
import { WhatsAppManager } from "@/components/admin/whatsapp/WhatsAppManager";

export const metadata: Metadata = {
  title: "بوت الواتساب التلقائي | لوحة تحكم TERRA HOP",
};

export default function WhatsAppAdminPage() {
  return <WhatsAppManager />;
}
