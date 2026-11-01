import { describe, expect, it } from "vitest";
import {
  acceptsOrders,
  cancelOrder,
  checkOrderStock,
  deriveProductStatus,
  locateVariant,
  productTotalStock,
  sellOrder,
  setProductStatus,
} from "./inventory";
import {
  canCancel,
  cancelReturnsStock,
  confirmOrderEmail,
  countOrderTabs,
  expireOrder,
  itemsSummary,
  lineTotal,
  orderPieces,
  orderTabOf,
  queryOrders,
  sellBlockReason,
  simulateWebsiteOrder,
  stockEffectLines,
} from "./orders";
import { createSeedData } from "./seed";
import type { AdminData, Order } from "./types";

const NOW = "2026-10-30T12:00:00.000Z";
const seed = createSeedData();
const order = (d: AdminData, n: string): Order => d.orders.find((o) => o.number === n)!;
const stockOf = (d: AdminData, id: string) => locateVariant(d.products, id)!.variant.stock;
const must = <T>(r: { ok: true; data: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`);
  return r.data;
};
const numbers = (list: Order[]) => list.map((o) => o.number);
const sumLog = (d: AdminData, variantId: string) =>
  d.movements.filter((m) => m.variantId === variantId).reduce((s, m) => s + m.delta, 0);

describe("orders list: tabs and counts", () => {
  it("every status maps to one tab, expired lives under cancelled", () => {
    expect(orderTabOf("AWAITING_APPROVAL")).toBe("needs_action");
    expect(orderTabOf("PENDING_EMAIL")).toBe("pending_email");
    expect(orderTabOf("SOLD")).toBe("sold");
    expect(orderTabOf("CANCELLED")).toBe("cancelled");
    expect(orderTabOf("EXPIRED")).toBe("cancelled");
  });

  it("tab counts add up to the total and match the demo data", () => {
    const c = countOrderTabs(seed.orders);
    expect(c.all).toBe(12);
    expect(c.needs_action).toBe(3);
    expect(c.pending_email).toBe(2);
    expect(c.sold).toBe(4);
    expect(c.cancelled).toBe(3); // 2 cancelled + 1 expired
    expect(c.needs_action + c.pending_email + c.sold + c.cancelled).toBe(c.all);
  });

  it("a tab returns only its orders, newest first", () => {
    const list = queryOrders(seed.orders, { tab: "needs_action", search: "" });
    expect(numbers(list)).toEqual(["TH-1012", "TH-1009", "TH-1008"]);
    const all = queryOrders(seed.orders, { tab: "all", search: "" });
    expect(all).toHaveLength(12);
    expect(all[0]!.number).toBe("TH-1012");
  });

  it("search matches number, customer, phone, email and product words in any order", () => {
    const find = (search: string) => numbers(queryOrders(seed.orders, { tab: "all", search }));
    expect(find("th-1008")).toEqual(["TH-1008"]);
    expect(find("1008")).toEqual(["TH-1008"]);
    expect(find("HANA")).toEqual(["TH-1008"]);
    expect(find("ahmed@example")).toEqual(["TH-1012"]);
    expect(find("hoodie olive")).toEqual(["TH-1008"]);
    expect(find("nothing-like-this")).toEqual([]);
  });

  it("search and tab combine", () => {
    expect(numbers(queryOrders(seed.orders, { tab: "sold", search: "hoodie" }))).toEqual(["TH-1007", "TH-1003", "TH-1001"]);
    expect(queryOrders(seed.orders, { tab: "pending_email", search: "ahmed" })).toEqual([]);
  });
});

describe("order helpers", () => {
  it("summarises items and counts pieces", () => {
    const o = order(seed, "TH-1012");
    expect(itemsSummary(o)).toEqual({ first: "Oversized Tee · Black · L × 2", more: 1 });
    expect(orderPieces(o)).toBe(3);
    expect(o.items.map(lineTotal)).toEqual([90000, 140000]);
  });

  it("stock effect lines merge the same variant", () => {
    const o = order(seed, "TH-1012");
    expect(stockEffectLines(o)).toHaveLength(2);
    const merged: Order = { ...o, items: [o.items[0]!, { ...o.items[0]!, qty: 3 }] };
    expect(stockEffectLines(merged)).toEqual([{ label: "Oversized Tee · Black · L", qty: 5 }]);
  });
});

describe("decision rules", () => {
  it("TH-1012 can be sold, TH-1008 cannot (not enough stock), closed orders cannot", () => {
    expect(sellBlockReason(seed, order(seed, "TH-1012"))).toBe(null);
    expect(sellBlockReason(seed, order(seed, "TH-1008"))).toBe("insufficient_stock");
    expect(sellBlockReason(seed, order(seed, "TH-1001"))).toBe("not_awaiting");
    expect(sellBlockReason(seed, order(seed, "TH-1010"))).toBe("not_awaiting");
  });

  it("cancel is allowed until cancelled or expired, and only SOLD returns stock", () => {
    expect(canCancel(order(seed, "TH-1012"))).toBe(true);
    expect(canCancel(order(seed, "TH-1001"))).toBe(true);
    expect(canCancel(order(seed, "TH-1010"))).toBe(true);
    expect(canCancel(order(seed, "TH-1004"))).toBe(false);
    expect(canCancel(order(seed, "TH-1005"))).toBe(false);
    expect(cancelReturnsStock(order(seed, "TH-1001"))).toBe(true);
    expect(cancelReturnsStock(order(seed, "TH-1012"))).toBe(false);
  });

  it("acceptance: sell deducts stock, cancel returns it exactly, the log adds up", () => {
    const o = order(seed, "TH-1012");
    const before = o.items.map((i) => stockOf(seed, i.variantId));

    const sold = must(sellOrder(seed, o.id, NOW));
    expect(order(sold, "TH-1012").status).toBe("SOLD");
    expect(o.items.map((i) => stockOf(sold, i.variantId))).toEqual(before.map((b, i) => b - o.items[i]!.qty));

    const cancelled = must(cancelOrder(sold, o.id, "Customer changed mind", NOW));
    expect(order(cancelled, "TH-1012").status).toBe("CANCELLED");
    expect(o.items.map((i) => stockOf(cancelled, i.variantId))).toEqual(before);
    for (const item of o.items) expect(sumLog(cancelled, item.variantId)).toBe(stockOf(cancelled, item.variantId));
  });

  it("cancelling an order that was never sold does not touch stock or the log", () => {
    const o = order(seed, "TH-1009");
    const cancelled = must(cancelOrder(seed, o.id, "", NOW));
    expect(cancelled.movements).toHaveLength(seed.movements.length);
    expect(stockOf(cancelled, o.items[0]!.variantId)).toBe(stockOf(seed, o.items[0]!.variantId));
    expect(order(cancelled, "TH-1009").timeline.at(-1)!.type).toBe("cancelled");
  });

  it("the sale and cancel timeline entries say who did it", () => {
    const sold = must(sellOrder(seed, order(seed, "TH-1012").id, NOW));
    const last = order(sold, "TH-1012").timeline.at(-1)!;
    expect(last).toMatchObject({ type: "sold", actor: "owner", at: NOW });
    const cancelled = must(cancelOrder(sold, order(sold, "TH-1012").id, "Wrong size", NOW));
    expect(order(cancelled, "TH-1012").timeline.at(-1)).toMatchObject({ type: "cancelled", actor: "owner", note: "Wrong size" });
  });

  it("selling the last piece turns the product to sold out automatically, cancelling brings it back", () => {
    const o = order(seed, "TH-1009"); // 1 x Long Sleeve, Black, L
    const productId = o.items[0]!.productId;
    const target = o.items[0]!.variantId;
    // Leave exactly one piece of this product in stock: the one the order wants.
    const d: AdminData = {
      ...seed,
      products: seed.products.map((p) =>
        p.id !== productId ? p : { ...p, variants: p.variants.map((v) => ({ ...v, stock: v.id === target ? 1 : 0 })) },
      ),
    };
    const productOf = (x: AdminData) => x.products.find((p) => p.id === productId)!;
    expect(productTotalStock(productOf(d))).toBe(1);
    expect(acceptsOrders(productOf(d), 3)).toBe(true);

    const sold = must(sellOrder(d, o.id, NOW));
    expect(productTotalStock(productOf(sold))).toBe(0);
    expect(deriveProductStatus(productOf(sold), 3).kind).toBe("sold_out");
    expect(acceptsOrders(productOf(sold), 3)).toBe(false);

    const back = must(cancelOrder(sold, o.id, "", NOW));
    expect(productTotalStock(productOf(back))).toBe(1); // cancelling a SOLD order returns the piece
    expect(deriveProductStatus(productOf(back), 3).kind).not.toBe("sold_out");
    expect(acceptsOrders(productOf(back), 3)).toBe(true);
  });
});

describe("email confirmation and expiry (preview of the real cycle)", () => {
  it("confirming moves PENDING_EMAIL to AWAITING_APPROVAL and writes the timeline", () => {
    const o = order(seed, "TH-1010");
    expect(o.status).toBe("PENDING_EMAIL");
    const next = must(confirmOrderEmail(seed, o.id, NOW));
    const updated = order(next, "TH-1010");
    expect(updated.status).toBe("AWAITING_APPROVAL");
    expect(updated.emailConfirmedAt).toBe(NOW);
    expect(updated.timeline.at(-1)).toMatchObject({ type: "email_confirmed", actor: "customer" });
  });

  it("confirming twice or confirming a non-pending order is refused", () => {
    const once = must(confirmOrderEmail(seed, order(seed, "TH-1010").id, NOW));
    const again = confirmOrderEmail(once, order(once, "TH-1010").id, NOW);
    expect(again).toEqual({ ok: false, error: "ORDER_NOT_PENDING_EMAIL" });
    expect(confirmOrderEmail(seed, order(seed, "TH-1001").id, NOW)).toEqual({ ok: false, error: "ORDER_NOT_PENDING_EMAIL" });
    expect(confirmOrderEmail(seed, "nope", NOW)).toEqual({ ok: false, error: "ORDER_NOT_FOUND" });
  });

  it("expiring closes a pending order without touching stock, and it cannot be sold or cancelled after", () => {
    const o = order(seed, "TH-1011");
    const next = must(expireOrder(seed, o.id, NOW));
    expect(order(next, "TH-1011")).toMatchObject({ status: "EXPIRED", cancelledAt: NOW });
    expect(order(next, "TH-1011").timeline.at(-1)).toMatchObject({ type: "expired", actor: "system" });
    expect(next.movements).toHaveLength(seed.movements.length);
    expect(sellOrder(next, o.id, NOW)).toEqual({ ok: false, error: "ORDER_NOT_AWAITING" });
    expect(cancelOrder(next, o.id, "", NOW)).toEqual({ ok: false, error: "ORDER_ALREADY_CLOSED" });
    expect(expireOrder(seed, order(seed, "TH-1012").id, NOW)).toEqual({ ok: false, error: "ORDER_NOT_PENDING_EMAIL" });
  });

  it("a confirmed order can be sold: the full cycle works", () => {
    const o = order(seed, "TH-1010");
    let d = must(confirmOrderEmail(seed, o.id, NOW));
    d = must(sellOrder(d, o.id, NOW));
    expect(order(d, "TH-1010").status).toBe("SOLD");
    expect(order(d, "TH-1010").timeline.map((e) => e.type)).toEqual(["placed", "email_confirmed", "sold"]);
  });
});

describe("simulated website orders", () => {
  it("awaiting: lands in Needs action with a placed and a confirmed event; pending: waits for the email", () => {
    const a = must(simulateWebsiteOrder(seed, "awaiting", NOW, 4));
    const created = a.orders.at(-1)!;
    expect(created.number).toBe("TH-1013");
    expect(created.status).toBe("AWAITING_APPROVAL");
    expect(created.source).toBe("website");
    expect(created.timeline.map((e) => e.type)).toEqual(["placed", "email_confirmed"]);
    expect(created.totalCents).toBe(created.items.reduce((s, i) => s + i.priceCentsSnapshot * i.qty, 0) + seed.settings.shippingCents);

    const p = must(simulateWebsiteOrder(seed, "pending", NOW, 4));
    expect(p.orders.at(-1)!.status).toBe("PENDING_EMAIL");
    expect(p.orders.at(-1)!.emailConfirmedAt).toBe(null);
  });

  it("is deterministic for the same seed and varies with the seed", () => {
    const x = must(simulateWebsiteOrder(seed, "awaiting", NOW, 7)).orders.at(-1)!;
    const y = must(simulateWebsiteOrder(seed, "awaiting", NOW, 7)).orders.at(-1)!;
    expect(x).toEqual(y);
    const different = new Set(Array.from({ length: 12 }, (_, s) => must(simulateWebsiteOrder(seed, "awaiting", NOW, s)).orders.at(-1)!.items[0]!.variantId));
    expect(different.size).toBeGreaterThan(3);
  });

  it("never orders sold out or draft products, and never more than the stock", () => {
    for (let s = 0; s < 40; s += 1) {
      const d = must(simulateWebsiteOrder(seed, "awaiting", NOW, s));
      for (const item of d.orders.at(-1)!.items) {
        const found = locateVariant(d.products, item.variantId)!;
        expect(acceptsOrders(found.product, seed.settings.lowStockThreshold)).toBe(true);
        expect(item.qty).toBeGreaterThan(0);
        expect(item.qty <= found.variant.stock).toBe(true);
      }
    }
  });

  it("fails with NOTHING_TO_ORDER when every product is sold out or hidden", () => {
    let d: AdminData = seed;
    for (const p of seed.products) d = must(setProductStatus(d, p.id, "draft", NOW));
    expect(simulateWebsiteOrder(d, "awaiting", NOW, 1)).toEqual({ ok: false, error: "NOTHING_TO_ORDER" });
  });

  it("does not change stock until the owner sells it", () => {
    const d = must(simulateWebsiteOrder(seed, "awaiting", NOW, 3));
    expect(d.movements).toHaveLength(seed.movements.length);
    const o = d.orders.at(-1)!;
    expect(sellBlockReason(d, o)).toBe(null);
    const sold = must(sellOrder(d, o.id, NOW));
    expect(sold.movements.length).toBeGreaterThan(seed.movements.length);
  });
});

describe("reservation mode (settings.reservation = hold)", () => {
  const hold: AdminData = { ...seed, settings: { ...seed.settings, reservation: "hold" } };

  it("in mode none, orders do not hold stock for each other (default)", () => {
    const line = checkOrderStock(seed, order(seed, "TH-1012")).find((l) => l.label.includes("Oversized Tee"))!;
    expect(line.reservedByOthers).toBe(0);
    expect(line.available).toBe(line.inStock);
  });

  it("in mode hold, pieces wanted by another waiting order are not available to this one", () => {
    // Make a second waiting order for the same variant as TH-1012's tee line.
    const base = order(hold, "TH-1012");
    const tee = base.items[0]!;
    const free = stockOf(hold, tee.variantId);
    const other: Order = { ...order(hold, "TH-1009"), id: "ord_x", number: "TH-1099", items: [{ ...tee, qty: free - 1 }] };
    const d: AdminData = { ...hold, orders: [...hold.orders, other] };
    const line = checkOrderStock(d, order(d, "TH-1012")).find((l) => l.variantId === tee.variantId)!;
    expect(line.inStock).toBe(free);
    expect(line.reservedByOthers).toBe(free - 1);
    expect(line.available).toBe(1);
    expect(line.ok).toBe(false); // TH-1012 wants 2
    expect(sellBlockReason(d, order(d, "TH-1012"))).toBe("insufficient_stock");
  });

  it("an order never reserves against itself", () => {
    const line = checkOrderStock(hold, order(hold, "TH-1012")).find((l) => l.label.includes("Oversized Tee"))!;
    expect(line.reservedByOthers).toBe(0);
    expect(line.ok).toBe(true);
  });

  it("a simulated order in hold mode never asks for pieces another order holds", () => {
    for (let s = 0; s < 30; s += 1) {
      const d = must(simulateWebsiteOrder(hold, "awaiting", NOW, s));
      const created = d.orders.at(-1)!;
      for (const line of checkOrderStock(d, created)) expect(line.ok).toBe(true);
    }
  });
});

describe("demo data stays consistent", () => {
  it("every variant's log adds up after a busy session of simulate, confirm, sell, cancel, expire", () => {
    let d = seed;
    d = must(simulateWebsiteOrder(d, "awaiting", NOW, 11));
    const a = d.orders.at(-1)!;
    d = must(simulateWebsiteOrder(d, "pending", NOW, 12));
    const b = d.orders.at(-1)!;
    d = must(confirmOrderEmail(d, b.id, NOW));
    d = must(sellOrder(d, a.id, NOW));
    d = must(sellOrder(d, b.id, NOW));
    d = must(cancelOrder(d, a.id, "Returned", NOW));
    d = must(simulateWebsiteOrder(d, "pending", NOW, 13));
    d = must(expireOrder(d, d.orders.at(-1)!.id, NOW));
    for (const p of d.products) for (const v of p.variants) {
      expect(sumLog(d, v.id)).toBe(v.stock);
      expect(v.stock).toBeGreaterThanOrEqual(0);
    }
    expect(countOrderTabs(d.orders).all).toBe(15);
  });
});
