import type { AdminData, Order } from "./types";
import { nextOrderNumber } from "./inventory";

export type OrderFilter = "all" | "needs_action" | "pending_email" | "sold" | "cancelled";
export type OrderSort = "newest" | "oldest" | "total_desc" | "total_asc";

export interface OrderCounts {
  all: number;
  needs_action: number;
  pending_email: number;
  sold: number;
  cancelled: number;
}

export function countOrdersByTab(orders: Order[]): OrderCounts {
  const counts: OrderCounts = {
    all: orders.length,
    needs_action: 0,
    pending_email: 0,
    sold: 0,
    cancelled: 0,
  };
  for (const o of orders) {
    if (o.status === "AWAITING_APPROVAL") counts.needs_action++;
    else if (o.status === "PENDING_EMAIL") counts.pending_email++;
    else if (o.status === "SOLD") counts.sold++;
    else if (o.status === "CANCELLED" || o.status === "EXPIRED") counts.cancelled++;
  }
  return counts;
}

export function filterOrders(orders: Order[], filter: OrderFilter): Order[] {
  if (filter === "all") return orders;
  if (filter === "needs_action") return orders.filter((o) => o.status === "AWAITING_APPROVAL");
  if (filter === "pending_email") return orders.filter((o) => o.status === "PENDING_EMAIL");
  if (filter === "sold") return orders.filter((o) => o.status === "SOLD");
  if (filter === "cancelled") return orders.filter((o) => o.status === "CANCELLED" || o.status === "EXPIRED");
  return orders;
}

export function searchOrders(orders: Order[], query: string): Order[] {
  const q = query.trim().toLowerCase();
  if (!q) return orders;
  return orders.filter((o) => {
    return (
      o.number.toLowerCase().includes(q) ||
      o.customer.name.toLowerCase().includes(q) ||
      o.customer.phone.toLowerCase().includes(q) ||
      o.customer.email.toLowerCase().includes(q) ||
      o.customer.city.toLowerCase().includes(q) ||
      o.items.some(
        (i) =>
          i.productName.toLowerCase().includes(q) ||
          i.colorName.toLowerCase().includes(q) ||
          i.size.toLowerCase().includes(q),
      )
    );
  });
}

export function sortOrders(orders: Order[], sort: OrderSort): Order[] {
  return [...orders].sort((a, b) => {
    if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sort === "total_desc") return b.totalCents - a.totalCents;
    if (sort === "total_asc") return a.totalCents - b.totalCents;
    return 0;
  });
}
