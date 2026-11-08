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
    case "PROCESSING":
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
