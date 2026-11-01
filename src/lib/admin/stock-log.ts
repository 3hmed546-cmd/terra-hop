/** Pure helpers for the Stock log tab on the product page. */
import { colorName } from "./inventory";
import type { AdminData, Product, StockReason } from "./types";

export interface StockLogRow {
  id: string;
  at: string;
  variantId: string;
  variantLabel: string | null; // null = the colour or size was removed from the product
  delta: number;
  before: number;
  after: number;
  reason: StockReason;
  orderId: string | null;
  orderNumber: string | null;
  note: string | null;
}

const seq = (id: string): number => Number(id.replace(/\D/g, "")) || 0;

export function variantLabelOf(product: Product, variantId: string): string | null {
  const v = product.variants.find((x) => x.id === variantId);
  return v ? `${colorName(product, v.colorId)} · ${v.size}` : null;
}

/** Newest first. `variantFilter` is a variant id or "all". */
export function stockLogForProduct(data: AdminData, productId: string, variantFilter: string = "all"): StockLogRow[] {
  const product = data.products.find((p) => p.id === productId);
  if (!product) return [];
  const orderNumbers = new Map(data.orders.map((o) => [o.id, o.number]));
  return data.movements
    .filter((m) => m.productId === productId && (variantFilter === "all" || m.variantId === variantFilter))
    .map((m) => ({
      id: m.id,
      at: m.createdAt,
      variantId: m.variantId,
      variantLabel: variantLabelOf(product, m.variantId),
      delta: m.delta,
      before: m.before,
      after: m.after,
      reason: m.reason,
      orderId: m.orderId,
      orderNumber: m.orderId ? (orderNumbers.get(m.orderId) ?? null) : null,
      note: m.note,
    }))
    .sort((a, b) => b.at.localeCompare(a.at) || seq(b.id) - seq(a.id));
}

export function stockLogVariantOptions(product: Product): { value: string; label: string }[] {
  return product.variants.map((v) => ({ value: v.id, label: `${colorName(product, v.colorId)} · ${v.size}` }));
}

/** "+10" or "−2" (real minus sign), so direction is readable without colour. */
export function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : delta < 0 ? `\u2212${Math.abs(delta)}` : "0";
}
