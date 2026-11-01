/**
 * Pure helpers for the orders screens and the order life cycle (plan 5.1).
 * No React, no storage, no clock and no randomness: `now` and `seed` are passed in,
 * so the same rules can run in the backend (phase B3/B4) unchanged.
 */
import { acceptsOrders, checkOrderStock, colorName, nextOrderNumber, orderSubtotal, reservedQuantities } from "./inventory";
import type { AdminData, Customer, Order, OrderItem, OrderStatus, Product, Result, Variant } from "./types";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: import("./types").ErrorCode): { ok: false; error: import("./types").ErrorCode } => ({ ok: false, error });

/* ---------- tabs, search, list ---------- */

export type OrderTab = "needs_action" | "pending_email" | "sold" | "cancelled" | "all";
export const ORDER_TABS: OrderTab[] = ["needs_action", "pending_email", "sold", "cancelled", "all"];

/** Which tab an order belongs to. Expired orders (auto-cancelled after 24 h) live under Cancelled. */
export function orderTabOf(status: OrderStatus): Exclude<OrderTab, "all"> {
  switch (status) {
    case "AWAITING_APPROVAL":
      return "needs_action";
    case "PENDING_EMAIL":
      return "pending_email";
    case "SOLD":
      return "sold";
    case "CANCELLED":
    case "EXPIRED":
      return "cancelled";
  }
}

export function countOrderTabs(orders: Order[]): Record<OrderTab, number> {
  const counts: Record<OrderTab, number> = { needs_action: 0, pending_email: 0, sold: 0, cancelled: 0, all: orders.length };
  for (const o of orders) counts[orderTabOf(o.status)] += 1;
  return counts;
}

function matchesSearch(order: Order, needle: string): boolean {
  if (!needle) return true;
  const haystack = [
    order.number,
    order.customer.name,
    order.customer.phone,
    order.customer.email,
    ...order.items.map((i) => `${i.productName} ${i.colorName} ${i.size}`),
  ]
    .join(" ")
    .toLowerCase();
  return needle
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/** Tab + search words, newest first (ties by order number so the order is stable). */
export function queryOrders(orders: Order[], query: { tab: OrderTab; search: string }): Order[] {
  const needle = query.search.trim();
  return orders
    .filter((o) => query.tab === "all" || orderTabOf(o.status) === query.tab)
    .filter((o) => matchesSearch(o, needle))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.number.localeCompare(a.number));
}

export function orderPieces(order: Order): number {
  return order.items.reduce((sum, i) => sum + i.qty, 0);
}

export function lineTotal(item: OrderItem): number {
  return item.priceCentsSnapshot * item.qty;
}

/** First item in full, the rest counted: "Oversized Tee · Black · L × 2" + 1 more. */
export function itemsSummary(order: Order): { first: string; more: number } {
  const [first, ...rest] = order.items;
  if (!first) return { first: "", more: 0 };
  return { first: `${first.productName} · ${first.colorName} · ${first.size} × ${first.qty}`, more: rest.length };
}

/* ---------- decisions ---------- */

export type SellBlock = "not_awaiting" | "insufficient_stock" | null;

/** Why "Mark as sold" is not possible right now (null = it is possible). */
export function sellBlockReason(data: AdminData, order: Order): SellBlock {
  if (order.status !== "AWAITING_APPROVAL") return "not_awaiting";
  return checkOrderStock(data, order).some((line) => !line.ok) ? "insufficient_stock" : null;
}

/** An order can be cancelled until it is already cancelled or expired. */
export function canCancel(order: Order): boolean {
  return order.status !== "CANCELLED" && order.status !== "EXPIRED";
}

export interface StockEffectLine {
  label: string;
  qty: number;
}

/** What marking this order as sold deducts, or what cancelling a SOLD order returns: one line per variant. */
export function stockEffectLines(order: Order): StockEffectLine[] {
  const byVariant = new Map<string, StockEffectLine>();
  for (const item of order.items) {
    const prev = byVariant.get(item.variantId);
    byVariant.set(item.variantId, {
      label: `${item.productName} · ${item.colorName} · ${item.size}`,
      qty: (prev?.qty ?? 0) + item.qty,
    });
  }
  return [...byVariant.values()];
}

/** Stock only moves for SOLD orders when cancelled (plan 5.2 rule 2). */
export function cancelReturnsStock(order: Order): boolean {
  return order.status === "SOLD";
}

/* ---------- simulated website events (preview only, replaced by the real checkout in B3) ---------- */

export type SimulatedKind = "awaiting" | "pending";

const DEMO_CUSTOMERS: Customer[] = [
  { name: "Tamer S.", phone: "0100 000 0101", email: "tamer@example.com", address: "18 Road 9, Maadi", city: "Cairo" },
  { name: "Rana M.", phone: "0100 000 0102", email: "rana@example.com", address: "5 Port Said St", city: "Alexandria" },
  { name: "Mazen K.", phone: "0100 000 0103", email: "mazen@example.com", address: "33 Al Ahram St", city: "Giza" },
  { name: "Farah A.", phone: "0100 000 0104", email: "farah@example.com", address: "9 Mostafa Kamel St", city: "Mansoura" },
  { name: "Hady N.", phone: "0100 000 0105", email: "hady@example.com", address: "27 Makram Ebeid", city: "Cairo" },
  { name: "Jana O.", phone: "0100 000 0106", email: "jana@example.com", address: "14 Tahrir St", city: "Tanta" },
];

interface Candidate {
  product: Product;
  variant: Variant;
  free: number;
}

/** Variants of products that still accept orders and have a piece left that no other order is holding. */
function orderableVariants(data: AdminData): Candidate[] {
  const held = reservedQuantities(data);
  return data.products
    .filter((p) => acceptsOrders(p, data.settings.lowStockThreshold))
    .flatMap((product) =>
      product.variants
        .map((variant) => ({ product, variant, free: variant.stock - (held.get(variant.id) ?? 0) }))
        .filter((c) => c.free > 0),
    );
}

const toItem = (c: Candidate, qty: number): OrderItem => ({
  productId: c.product.id,
  variantId: c.variant.id,
  productName: c.product.name,
  colorName: colorName(c.product, c.variant.colorId),
  size: c.variant.size,
  qty,
  priceCentsSnapshot: c.product.priceCents,
});

/**
 * Creates the order a customer would create at checkout.
 * Sold-out and draft products never appear in it (plan 5.2 rule 5). Fails with NOTHING_TO_ORDER
 * when no product can take an order. `seed` is any non-negative integer: same seed, same order.
 */
export function simulateWebsiteOrder(data: AdminData, kind: SimulatedKind, now: string, seed: number): Result<AdminData> {
  const candidates = orderableVariants(data);
  if (candidates.length === 0) return fail("NOTHING_TO_ORDER");
  const s = Math.max(0, Math.floor(seed));

  const first = candidates[s % candidates.length]!;
  const items: OrderItem[] = [toItem(first, Math.min(first.free, s % 3 === 0 ? 2 : 1))];
  if (s % 2 === 1) {
    const others = candidates.filter((c) => c.product.id !== first.product.id);
    const second = others[Math.floor(s / 2) % Math.max(1, others.length)];
    if (second) items.push(toItem(second, 1));
  }

  const number = nextOrderNumber(data.orders);
  const nowMs = Date.parse(now);
  const placedAt = kind === "awaiting" ? new Date(nowMs - 2 * 60_000).toISOString() : now;
  const confirmed = kind === "awaiting";
  const order: Order = {
    id: `ord_${number.slice(3)}`,
    number,
    source: "website",
    status: confirmed ? "AWAITING_APPROVAL" : "PENDING_EMAIL",
    customer: DEMO_CUSTOMERS[s % DEMO_CUSTOMERS.length]!,
    notes: "",
    items,
    shippingCents: data.settings.shippingCents,
    totalCents: orderSubtotal(items) + data.settings.shippingCents,
    createdAt: placedAt,
    emailConfirmedAt: confirmed ? now : null,
    soldAt: null,
    cancelledAt: null,
    cancelReason: null,
    timeline: [
      { at: placedAt, type: "placed", actor: "customer" },
      ...(confirmed ? [{ at: now, type: "email_confirmed" as const, actor: "customer" as const }] : []),
    ],
  };
  return ok({ ...data, orders: [...data.orders, order] });
}

function patchOrder(data: AdminData, orderId: string, fn: (o: Order) => Order): AdminData {
  return { ...data, orders: data.orders.map((o) => (o.id === orderId ? fn(o) : o)) };
}

/** The customer clicked "Confirm" in the email: the order now waits for the owner's decision. */
export function confirmOrderEmail(data: AdminData, orderId: string, now: string): Result<AdminData> {
  const order = data.orders.find((o) => o.id === orderId);
  if (!order) return fail("ORDER_NOT_FOUND");
  if (order.status !== "PENDING_EMAIL") return fail("ORDER_NOT_PENDING_EMAIL");
  return ok(
    patchOrder(data, orderId, (o) => ({
      ...o,
      status: "AWAITING_APPROVAL",
      emailConfirmedAt: now,
      timeline: [...o.timeline, { at: now, type: "email_confirmed", actor: "customer" }],
    })),
  );
}

/** No confirmation within the allowed hours: the order is closed automatically and no stock is touched. */
export function expireOrder(data: AdminData, orderId: string, now: string): Result<AdminData> {
  const order = data.orders.find((o) => o.id === orderId);
  if (!order) return fail("ORDER_NOT_FOUND");
  if (order.status !== "PENDING_EMAIL") return fail("ORDER_NOT_PENDING_EMAIL");
  return ok(
    patchOrder(data, orderId, (o) => ({
      ...o,
      status: "EXPIRED",
      cancelledAt: now,
      timeline: [...o.timeline, { at: now, type: "expired", actor: "system" }],
    })),
  );
}
