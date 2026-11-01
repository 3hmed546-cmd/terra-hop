import type { Metadata } from "next";
import { RecordSaleForm } from "@/components/admin/sales/RecordSaleForm";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";

export const metadata: Metadata = { title: ADMIN_STRINGS.pages.salesNew.title };

export default function Page() {
  return <RecordSaleForm />;
}
