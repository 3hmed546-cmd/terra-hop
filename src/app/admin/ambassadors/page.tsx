import type { Metadata } from "next";
import { AmbassadorsManager } from "@/components/admin/ambassadors/AmbassadorsManager";

export const metadata: Metadata = {
  title: "سفراء الشارع | لوحة تحكم TERRA HOP",
};

export default function AmbassadorsPage() {
  return <AmbassadorsManager />;
}
