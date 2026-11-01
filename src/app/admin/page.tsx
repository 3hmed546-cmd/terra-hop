import { redirect } from "next/navigation";
import { adminHref } from "@/lib/admin/paths";

export default function AdminIndexPage() {
  redirect(adminHref("/dashboard"));
}
