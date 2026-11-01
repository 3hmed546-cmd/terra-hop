/** Pure helpers for the Dashboard: sales totals (Cairo time), decision queue, restock list. */
import { deriveProductStatus, effectiveThreshold, productTotalStock } from "./inventory";
import type { AdminData, Order, Product } from "./types";

const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" });

/** "2026-10-30" for the calendar day in Cairo. */
export function cairoDayKey(iso: string): string {
  return DAY.format(new Date(iso));
}

/** "2026-10" for the calendar month in Cairo. */
export function cairoMonthKey(iso: string): string {
  return cairoDayKey(iso).slice(0, 7);
}

export interface SalesSummary {
  todayCount: number;
  todayCents: number;
  monthCount: number;
  monthCents: number;
}

/**
 * Only orders that are SOLD right now count (a cancelled sale is gone from the totals).
 * The amount is what the customer pays: items plus shipping. The day is the day it was sold.
 */
export function salesSummary(orders: Order[], nowIso: string): SalesSummary {
  const today = cairoDayKey(nowIso);
  const month = cairoMonthKey(nowIso);
  const out: SalesSummary = { todayCount: 0, todayCents: 0, monthCount: 0, monthCents: 0 };
  for (const o of orders) {
    if (o.status !== "SOLD") continue;
    const when = o.soldAt ?? o.createdAt;
    if (cairoMonthKey(when) === month) {
      out.monthCount += 1;
      out.monthCents += o.totalCents;
    }
    if (cairoDayKey(when) === today) {
      out.todayCount += 1;
      out.todayCents += o.totalCents;
    }
  }
  return out;
}

/** The newest orders waiting for the owner's decision, plus how many there are in total. */
export function decisionQueue(orders: Order[], limit = 5): { rows: Order[]; total: number } {
  const waiting = orders
    .filter((o) => o.status === "AWAITING_APPROVAL")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { rows: waiting.slice(0, limit), total: waiting.length };
}

/** Published products at or below their low-stock limit (including ones with nothing left). */
export function restockCandidates(data: AdminData): Product[] {
  return data.products
    .filter((p) => p.status !== "draft" && productTotalStock(p) <= effectiveThreshold(p, data.settings.lowStockThreshold))
    .sort((a, b) => productTotalStock(a) - productTotalStock(b) || a.name.localeCompare(b.name));
}

export interface DashboardKpis extends SalesSummary {
  needsAction: number;
  lowStock: number;
  soldOut: number;
}

export function dashboardKpis(data: AdminData, nowIso: string): DashboardKpis {
  const candidates = restockCandidates(data);
  return {
    ...salesSummary(data.orders, nowIso),
    needsAction: data.orders.filter((o) => o.status === "AWAITING_APPROVAL").length,
    lowStock: candidates.length,
    soldOut: candidates.filter((p) => deriveProductStatus(p, data.settings.lowStockThreshold).kind === "sold_out").length,
  };
}
