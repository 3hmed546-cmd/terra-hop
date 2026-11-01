import { describe, expect, it } from "vitest";
import { cairoDayKey, cairoMonthKey, dashboardKpis, decisionQueue, restockCandidates, salesSummary } from "./dashboard";
import { cancelOrder, sellOrder } from "./inventory";
import { createSeedData } from "./seed";
import type { AdminData, Order } from "./types";

const seed = createSeedData();
const sold = seed.orders.filter((o) => o.status === "SOLD");

describe("Cairo calendar keys", () => {
  it("uses the Cairo day, not the UTC day", () => {
    expect(cairoDayKey("2026-10-31T22:30:00.000Z")).toBe("2026-11-01");
    expect(cairoDayKey("2026-10-31T20:30:00.000Z")).toBe("2026-10-31");
    expect(cairoMonthKey("2026-10-31T22:30:00.000Z")).toBe("2026-11");
  });
});

describe("salesSummary", () => {
  it("counts only SOLD orders of the month, using what the customer pays", () => {
    const s = salesSummary(seed.orders, "2026-10-30T10:00:00.000Z");
    expect(s.monthCount).toBe(4);
    expect(s.monthCents).toBe(sold.reduce((sum, o) => sum + o.totalCents, 0));
    expect(s.todayCount).toBe(0);
    expect(s.todayCents).toBe(0);
  });

  it("splits today from the rest of the month", () => {
    const s = salesSummary(seed.orders, "2026-10-28T15:00:00.000Z");
    const day = sold.filter((o) => o.soldAt!.startsWith("2026-10-28"));
    expect(s.todayCount).toBe(day.length);
    expect(s.todayCents).toBe(day.reduce((sum, o) => sum + o.totalCents, 0));
    expect(s.monthCount).toBe(4);
  });

  it("drops a sale when it is cancelled and ignores orders that were never sold", () => {
    const id = seed.orders.find((o) => o.number === "TH-1012")!.id;
    const before = salesSummary(seed.orders, "2026-10-30T10:00:00.000Z");
    const afterSell = sellOrder(seed, id, "2026-10-30T09:00:00.000Z");
    if (!afterSell.ok) throw new Error("expected ok");
    const sellSummary = salesSummary(afterSell.data.orders, "2026-10-30T10:00:00.000Z");
    expect(sellSummary.todayCount).toBe(1);
    expect(sellSummary.monthCount).toBe(before.monthCount + 1);
    const afterCancel = cancelOrder(afterSell.data, id, "", "2026-10-30T09:30:00.000Z");
    if (!afterCancel.ok) throw new Error("expected ok");
    expect(salesSummary(afterCancel.data.orders, "2026-10-30T10:00:00.000Z")).toEqual(before);
  });

  it("puts a sale made just after midnight in Cairo into the new month", () => {
    const order = { ...sold[0], soldAt: "2026-10-31T22:30:00.000Z" } as Order;
    expect(salesSummary([order], "2026-10-31T10:00:00.000Z").monthCount).toBe(0);
    expect(salesSummary([order], "2026-11-01T10:00:00.000Z")).toMatchObject({ monthCount: 1, todayCount: 1 });
  });
});

describe("decisionQueue", () => {
  it("lists newest waiting orders first and reports the total", () => {
    const q = decisionQueue(seed.orders);
    expect(q.total).toBe(3);
    expect(q.rows.map((o) => o.number)).toEqual(["TH-1012", "TH-1009", "TH-1008"]);
    expect(q.rows.every((o) => o.status === "AWAITING_APPROVAL")).toBe(true);
  });
  it("caps the list at the limit but keeps the real total", () => {
    const many: Order[] = Array.from({ length: 8 }, (_, i) => ({ ...seed.orders.find((o) => o.number === "TH-1012")!, id: `x${i}`, createdAt: `2026-10-2${i}T10:00:00.000Z` }));
    const q = decisionQueue(many, 5);
    expect(q.rows).toHaveLength(5);
    expect(q.total).toBe(8);
  });
});

describe("restockCandidates and KPIs", () => {
  it("includes sold-out and low products, never drafts or healthy ones", () => {
    const names = restockCandidates(seed).map((p) => p.name);
    expect(names).toContain("Zip Hoodie"); // low (3 left)
    expect(names).toContain("Archive Tee"); // nothing left
    expect(names).not.toContain("Fleece Pullover"); // draft
    expect(names).not.toContain("Oversized Tee");
  });
  it("lists the emptiest first", () => {
    const totals = restockCandidates(seed).map((p) => p.variants.reduce((s, v) => s + v.stock, 0));
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
  });
  it("respects a per-product limit", () => {
    const data: AdminData = { ...seed, products: seed.products.map((p) => (p.id === "p_oversized_tee" ? { ...p, lowStockThreshold: 100 } : p)) };
    expect(restockCandidates(data).map((p) => p.name)).toContain("Oversized Tee");
  });
  it("builds the four KPI numbers", () => {
    const k = dashboardKpis(seed, "2026-10-30T10:00:00.000Z");
    expect(k.needsAction).toBe(3);
    expect(k.lowStock).toBe(restockCandidates(seed).length);
    expect(k.soldOut).toBeGreaterThanOrEqual(1);
    expect(k.monthCount).toBe(4);
  });
});
