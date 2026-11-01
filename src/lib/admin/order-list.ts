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

const SAMPLE_CUSTOMERS = [
  { name: "Kareem Tarek", phone: "01098765432", email: "kareem.t@gmail.com", address: "14 Degla St, Maadi", city: "Cairo" },
  { name: "Ziad Mansour", phone: "01123456789", email: "ziad.m@outlook.com", address: "22 El Horreya Ave", city: "Alexandria" },
  { name: "Youssef Nabil", phone: "01234567891", email: "youssef.nabil@yahoo.com", address: "5th Settlement, New Cairo", city: "Cairo" },
  { name: "Hassan Farouk", phone: "01555544433", email: "hassan.f@mail.com", address: "8 Gezira St, Zamalek", city: "Cairo" },
];

/** Simulates a new website order (for testing the order lifecycle without a backend). */
export function simulateOrder(
  data: AdminData,
  targetStatus: "AWAITING_APPROVAL" | "PENDING_EMAIL",
  now: string,
): { ok: true; data: AdminData } | { ok: false; error: import("./types").ErrorCode } {
  // Find in-stock products
  const candidates: { product: import("./types").Product; variant: import("./types").Variant }[] = [];
  for (const p of data.products) {
    if (p.status === "active" && !p.forceSoldOut) {
      for (const v of p.variants) {
        if (v.stock > 0) candidates.push({ product: p, variant: v });
      }
    }
  }

  if (candidates.length === 0) {
    return { ok: false, error: "INSUFFICIENT_STOCK" };
  }

  // Pick 1 or 2 items
  const picked1 = candidates[Math.floor(Math.random() * candidates.length)];
  const item1: import("./types").OrderItem = {
    productId: picked1.product.id,
    variantId: picked1.variant.id,
    productName: picked1.product.name,
    colorName: picked1.product.colors.find((c) => c.id === picked1.variant.colorId)?.name ?? "Standard",
    size: picked1.variant.size,
    qty: 1,
    priceCentsSnapshot: picked1.product.priceCents,
  };

  const items = [item1];
  const subtotal = items.reduce((acc, i) => acc + i.priceCentsSnapshot * i.qty, 0);
  const shippingCents = data.settings.shippingCents ?? 6000;
  const totalCents = subtotal + shippingCents;

  const number = nextOrderNumber(data.orders);
  const customer = SAMPLE_CUSTOMERS[Math.floor(Math.random() * SAMPLE_CUSTOMERS.length)];

  const order: Order = {
    id: `ord_${number.slice(3)}`,
    number,
    source: "website",
    status: targetStatus,
    customer,
    notes: "Please call before delivery",
    items,
    shippingCents,
    totalCents,
    createdAt: now,
    emailConfirmedAt: targetStatus === "AWAITING_APPROVAL" ? now : null,
    soldAt: null,
    cancelledAt: null,
    cancelReason: null,
    timeline: [
      { at: now, type: "placed", actor: "customer" },
      ...(targetStatus === "AWAITING_APPROVAL"
        ? [{ at: now, type: "email_confirmed" as const, actor: "customer" as const }]
        : []),
    ],
  };

  return { ok: true, data: { ...data, orders: [order, ...data.orders] } };
}
