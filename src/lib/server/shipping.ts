import type Database from "better-sqlite3";

export type ShippingRules = {
  flatRateCents: number;
  freeShippingMinQuantity: number;
  freeShippingMinAmountCents: number;
};

const FALLBACK: ShippingRules = {
  flatRateCents: 6000,
  freeShippingMinQuantity: 2,
  freeShippingMinAmountCents: 0,
};

function readJson(db: Database.Database, group: string, key: string): unknown {
  const row = db
    .prepare("SELECT value FROM settings WHERE group_key = ? AND key = ?")
    .get(group, key) as { value: string } | undefined;
  if (!row) return undefined;
  try {
    return JSON.parse(row.value);
  } catch {
    return undefined;
  }
}

/** مصدر واحد للشحن. إعدادات الأدمن (store/shippingCents) لها الأولوية. */
export function getShippingRules(db: Database.Database): ShippingRules {
  const rules = (readJson(db, "shipping", "rules") ?? {}) as Partial<ShippingRules>;
  const adminFlat = readJson(db, "store", "shippingCents");
  const flat = typeof adminFlat === "number" ? adminFlat : rules.flatRateCents;
  return {
    flatRateCents: Number.isFinite(flat) ? Number(flat) : FALLBACK.flatRateCents,
    freeShippingMinQuantity: rules.freeShippingMinQuantity ?? FALLBACK.freeShippingMinQuantity,
    freeShippingMinAmountCents: rules.freeShippingMinAmountCents ?? FALLBACK.freeShippingMinAmountCents,
  };
}

export function calcShippingCents(r: ShippingRules, qty: number, subtotalCents: number): number {
  const freeByQty = r.freeShippingMinQuantity > 0 && qty >= r.freeShippingMinQuantity;
  const freeByAmount = r.freeShippingMinAmountCents > 0 && subtotalCents >= r.freeShippingMinAmountCents;
  return freeByQty || freeByAmount ? 0 : r.flatRateCents;
}
