import type { Metadata } from "next";
import { OrdersList } from "@/components/admin/orders/OrdersList";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";

export const metadata: Metadata = { title: ADMIN_STRINGS.pages.orders.title };

export default function Page() {
  return <OrdersList />;
}
