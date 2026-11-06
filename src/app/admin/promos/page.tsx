import type { Metadata } from "next";
import { PromosManager } from "@/components/admin/promos/PromosManager";

export const metadata: Metadata = {
  title: "أكواد الخصم والبرومو | لوحة تحكم TERRA HOP",
};

export default function PromosPage() {
  return <PromosManager />;
}
