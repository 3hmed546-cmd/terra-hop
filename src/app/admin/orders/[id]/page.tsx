import type { Metadata } from "next";
import { OrderDetail } from "@/components/admin/orders/OrderDetail";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";

export const metadata: Metadata = { title: ADMIN_STRINGS.pages.orderDetail.title };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetail orderId={id} />;
}
