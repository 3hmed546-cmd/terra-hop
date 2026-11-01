/**
 * Pure helpers for the products list: search, status filter, sort, counts.
 * No React and no storage, so the same rules can be reused by the API in phase B2.
 */
import { ADMIN_STRINGS } from "./admin-strings";
import { deriveProductStatus, productTotalStock } from "./inventory";
import type { DerivedProductStatus, Product } from "./types";

export type StatusFilter = "all" | DerivedProductStatus;
export type SortKey = "updated" | "name" | "price_asc" | "price_desc" | "stock_asc";

export interface ListQuery {
  search: string;
  status: StatusFilter;
  sort: SortKey;
}

export const DEFAULT_QUERY: ListQuery = { search: "", status: "all", sort: "updated" };

export const STATUS_FILTERS: StatusFilter[] = ["all", "available", "low", "sold_out", "draft"];
export const SORT_KEYS: SortKey[] = ["updated", "name", "price_asc", "price_desc", "stock_asc"];

export function isDefaultQuery(q: ListQuery): boolean {
  return q.search.trim() === "" && q.status === "all";
}

export function countByStatus(products: Product[], defaultThreshold: number): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = { all: products.length, available: 0, low: 0, sold_out: 0, draft: 0 };
  for (const p of products) counts[deriveProductStatus(p, defaultThreshold).kind] += 1;
  return counts;
}

function matchesSearch(product: Product, needle: string): boolean {
  if (!needle) return true;
  const haystack = `${product.name} ${product.slug} ${ADMIN_STRINGS.products.category[product.category]}`.toLowerCase();
  return needle
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

function compare(a: Product, b: Product, sort: SortKey): number {
  switch (sort) {
    case "name":
      return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    case "price_asc":
      return a.priceCents - b.priceCents;
    case "price_desc":
      return b.priceCents - a.priceCents;
    case "stock_asc":
      return productTotalStock(a) - productTotalStock(b);
    case "updated":
      return b.updatedAt.localeCompare(a.updatedAt);
  }
}

/** Filter by search words and status, then sort. Ties fall back to name so the order is stable. */
export function queryProducts(products: Product[], query: ListQuery, defaultThreshold: number): Product[] {
  const needle = query.search.trim();
  return products
    .filter((p) => matchesSearch(p, needle))
    .filter((p) => query.status === "all" || deriveProductStatus(p, defaultThreshold).kind === query.status)
    .sort((a, b) => compare(a, b, query.sort) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}
