/**
 * Pure business logic (no React, no storage, no clock). Every function takes the
 * current AdminData and returns a new one, so the same rules can move to the
 * backend (inside a DB transaction) in phase B4 without changing their meaning.
 */
import { slugify } from "./format";
import type {
  AdminData,
  ColorOption,
  Customer,
  DerivedProductStatus,
  Order,
  OrderItem,
  Product,
  Result,
  StockReason,
  Variant,
} from "./types";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: import("./types").ErrorCode): { ok: false; error: import("./types").ErrorCode } => ({
  ok: false,
  error,
});

/* ---------- stock & status ---------- */

export function productTotalStock(product: Product): number {
  return product.variants.reduce((sum, v) => sum + v.stock, 0);
}

export function effectiveThreshold(product: Product, defaultThreshold: number): number {
  return product.lowStockThreshold ?? defaultThreshold;
}

/** Draft wins; then forced/zero stock = sold out; then low; else available. */
export function deriveProductStatus(
  product: Product,
  defaultThreshold: number,
): { kind: DerivedProductStatus; total: number } {
  const total = productTotalStock(product);
  if (product.status === "draft") return { kind: "draft", total };
  if (product.forceSoldOut || total === 0) return { kind: "sold_out", total };
  if (total <= effectiveThreshold(product, defaultThreshold)) return { kind: "low", total };
  return { kind: "available", total };
}

/** Sold-out and draft products do not accept new website orders. */
export function acceptsOrders(product: Product, defaultThreshold: number): boolean {
  const { kind } = deriveProductStatus(product, defaultThreshold);
  return kind === "available" || kind === "low";
}

export function locateVariant(
  products: Product[],
  variantId: string,
): { product: Product; variant: Variant } | null {
  for (const product of products) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant) return { product, variant };
  }
  return null;
}

export function variantId(productId: string, colorId: string, size: string): string {
  return `${productId}__${colorId}__${slugify(size)}`;
}

/** Builds the colour x size grid, keeping stock already entered for surviving cells. */
export function generateVariants(
  productId: string,
  colors: ColorOption[],
  sizes: string[],
  existing: Variant[] = [],
): Variant[] {
  const previous = new Map(existing.map((v) => [v.id, v.stock]));
  return colors.flatMap((color) =>
    sizes.map((size) => {
      const id = variantId(productId, color.id, size);
      return { id, colorId: color.id, size, stock: previous.get(id) ?? 0 };
    }),
  );
}

export function colorName(product: Product, colorId: string): string {
  return product.colors.find((c) => c.id === colorId)?.name ?? colorId;
}

/* ---------- low-level stock change (always logs a movement) ---------- */

export function changeStock(
  data: AdminData,
  variantIdValue: string,
  delta: number,
  meta: { reason: StockReason; orderId?: string; note?: string },
  now: string,
): Result<AdminData> {
  const found = locateVariant(data.products, variantIdValue);
  if (!found) return fail("VARIANT_NOT_FOUND");
  const before = found.variant.stock;
  const after = before + delta;
  if (after < 0) return fail("INSUFFICIENT_STOCK");

  const products = data.products.map((p) =>
    p.id !== found.product.id
      ? p
      : {
          ...p,
          updatedAt: now,
          variants: p.variants.map((v) => (v.id === variantIdValue ? { ...v, stock: after } : v)),
        },
  );
  const movement = {
    id: `mv_${data.movements.length + 1}`,
    variantId: variantIdValue,
    productId: found.product.id,
    delta,
    before,
    after,
    reason: meta.reason,
    orderId: meta.orderId ?? null,
    note: meta.note ?? null,
    createdAt: now,
  };
  return ok({ ...data, products, movements: [...data.movements, movement] });
}

/** Quick restock / correction: set a variant to an exact count, with a note. */
export function adjustStock(
  data: AdminData,
  variantIdValue: string,
  newStock: number,
  note: string,
  now: string,
): Result<AdminData> {
  if (!Number.isInteger(newStock) || newStock < 0) return fail("INVALID_QUANTITY");
  const found = locateVariant(data.products, variantIdValue);
  if (!found) return fail("VARIANT_NOT_FOUND");
  const delta = newStock - found.variant.stock;
  if (delta === 0) return fail("NO_CHANGE");
  return changeStock(data, variantIdValue, delta, { reason: "manual_adjust", note: note || undefined }, now);
}

/* ---------- orders ---------- */

export function orderSubtotal(items: OrderItem[]): number {
  return items.reduce((sum, i) => sum + i.priceCentsSnapshot * i.qty, 0);
}

export function nextOrderNumber(orders: Order[]): string {
  const max = orders.reduce((m, o) => Math.max(m, Number(o.number.replace(/^TH-/, "")) || 0), 1000);
  return `TH-${max + 1}`;
}

export interface StockCheckLine {
  variantId: string;
  label: string;
  requested: number;
  /** Pieces physically in stock. */
  inStock: number;
  /** Pieces held for OTHER orders waiting for a decision. Always 0 unless settings.reservation is "hold". */
  reservedByOthers: number;
  /** What this order can actually use: inStock minus reservedByOthers (never below 0). */
  available: number;
  after: number;
  ok: boolean;
}

/**
 * Reservation mode "hold" (plan 5.3, option 2): pieces of every order that is waiting for the owner's
 * decision are held. Returns how many pieces of each variant are held by orders other than `exceptOrderId`.
 * In mode "none" nothing is held.
 */
export function reservedQuantities(data: AdminData, exceptOrderId?: string): Map<string, number> {
  const held = new Map<string, number>();
  if (data.settings.reservation !== "hold") return held;
  for (const o of data.orders) {
    if (o.status !== "AWAITING_APPROVAL" || o.id === exceptOrderId) continue;
    for (const item of o.items) held.set(item.variantId, (held.get(item.variantId) ?? 0) + item.qty);
  }
  return held;
}

/** Per variant: what is in stock now and what remains after this order sells. */
export function checkOrderStock(data: AdminData, order: Order): StockCheckLine[] {
  const requested = new Map<string, { label: string; qty: number }>();
  for (const item of order.items) {
    const prev = requested.get(item.variantId);
    requested.set(item.variantId, {
      label: `${item.productName} · ${item.colorName} · ${item.size}`,
      qty: (prev?.qty ?? 0) + item.qty,
    });
  }
  const held = reservedQuantities(data, order.id);
  return [...requested.entries()].map(([id, { label, qty }]) => {
    const inStock = locateVariant(data.products, id)?.variant.stock ?? 0;
    const reservedByOthers = Math.min(held.get(id) ?? 0, inStock);
    const available = inStock - reservedByOthers;
    return {
      variantId: id,
      label,
      requested: qty,
      inStock,
      reservedByOthers,
      available,
      after: available - qty,
      ok: available >= qty,
    };
  });
}

function updateOrder(data: AdminData, orderId: string, fn: (o: Order) => Order): AdminData {
  return { ...data, orders: data.orders.map((o) => (o.id === orderId ? fn(o) : o)) };
}

/** "Mark as sold": deducts stock for every item, all-or-nothing. */
export function sellOrder(data: AdminData, orderId: string, now: string): Result<AdminData> {
  const order = data.orders.find((o) => o.id === orderId);
  if (!order) return fail("ORDER_NOT_FOUND");
  if (order.status !== "AWAITING_APPROVAL") return fail("ORDER_NOT_AWAITING");
  if (checkOrderStock(data, order).some((line) => !line.ok)) return fail("INSUFFICIENT_STOCK");

  let next = data;
  for (const item of order.items) {
    const r = changeStock(next, item.variantId, -item.qty, { reason: "sale", orderId: order.id }, now);
    if (!r.ok) return r;
    next = r.data;
  }
  return ok(
    updateOrder(next, orderId, (o) => ({
      ...o,
      status: "SOLD",
      soldAt: now,
      timeline: [...o.timeline, { at: now, type: "sold", actor: "owner" }],
    })),
  );
}

/** Cancel an order. A SOLD order gets its stock returned to the same colour and size. */
export function cancelOrder(
  data: AdminData,
  orderId: string,
  reason: string,
  now: string,
): Result<AdminData> {
  const order = data.orders.find((o) => o.id === orderId);
  if (!order) return fail("ORDER_NOT_FOUND");
  if (order.status === "CANCELLED" || order.status === "EXPIRED") return fail("ORDER_ALREADY_CLOSED");

  let next = data;
  if (order.status === "SOLD") {
    for (const item of order.items) {
      const r = changeStock(
        next,
        item.variantId,
        item.qty,
        { reason: "cancel_restock", orderId: order.id, note: reason || undefined },
        now,
      );
      if (!r.ok) return r;
      next = r.data;
    }
  }
  return ok(
    updateOrder(next, orderId, (o) => ({
      ...o,
      status: "CANCELLED",
      cancelledAt: now,
      cancelReason: reason || null,
      timeline: [...o.timeline, { at: now, type: "cancelled", actor: "owner", note: reason || undefined }],
    })),
  );
}

export interface ManualSaleInput {
  variantId: string;
  qty: number;
  unitPriceCents: number;
  buyerName?: string;
  note?: string;
}

export interface WebsiteCheckoutInput {
  customer: Customer;
  notes?: string;
  items: Array<{
    productSlug?: string;
    productName: string;
    colorName?: string;
    size: string;
    qty: number;
    priceCents: number;
  }>;
}

/** Creates a customer order from the website checkout (Cash on Delivery). */
export function createWebsiteCheckoutOrder(
  data: AdminData,
  input: WebsiteCheckoutInput,
  now: string,
): { data: AdminData; order: Order } {
  const number = nextOrderNumber(data.orders);

  const orderItems: OrderItem[] = input.items.map((it, idx) => {
    let pId = "";
    let vId = "";
    let color = it.colorName || "Standard";

    const matchedProduct = data.products.find(
      (p) =>
        (it.productSlug && p.slug === it.productSlug) ||
        p.name.toLowerCase() === it.productName.toLowerCase(),
    );

    if (matchedProduct) {
      pId = matchedProduct.id;
      const matchedVariant =
        matchedProduct.variants.find((v) => v.size.toUpperCase() === it.size.toUpperCase()) ||
        matchedProduct.variants[0];
      if (matchedVariant) {
        vId = matchedVariant.id;
        const colorObj = matchedProduct.colors.find((c) => c.id === matchedVariant.colorId);
        if (colorObj) color = colorObj.name;
      }
    }

    return {
      productId: pId || `p_${idx + 1}`,
      variantId: vId || `var_${idx + 1}`,
      productName: it.productName,
      colorName: color,
      size: it.size,
      qty: it.qty,
      priceCentsSnapshot: it.priceCents,
    };
  });

  const subtotal = orderItems.reduce((acc, it) => acc + it.priceCentsSnapshot * it.qty, 0);
  const shippingCents = data.settings.shippingCents ?? 6000;
  const totalCents = subtotal + shippingCents;

  const order: Order = {
    id: `ord_${number.slice(3)}`,
    number,
    source: "website",
    status: "AWAITING_APPROVAL",
    customer: input.customer,
    notes: input.notes?.trim() || "طلب من الموقع (الدفع عند الاستلام)",
    items: orderItems,
    shippingCents,
    totalCents,
    createdAt: now,
    emailConfirmedAt: now,
    soldAt: null,
    cancelledAt: null,
    cancelReason: null,
    timeline: [
      { at: now, type: "placed", actor: "customer" },
      { at: now, type: "email_confirmed", actor: "customer", note: "تم تأكيد الأوردر عبر صفحة التشيك آوت" },
    ],
  };

  return {
    data: {
      ...data,
      orders: [order, ...data.orders],
    },
    order,
  };
}

/** "Record a sale": creates a SOLD order with source "manual" and deducts stock. */
export function recordManualSale(data: AdminData, input: ManualSaleInput, now: string): Result<AdminData> {
  if (!Number.isInteger(input.qty) || input.qty < 1) return fail("INVALID_QUANTITY");
  if (!Number.isInteger(input.unitPriceCents) || input.unitPriceCents < 0) return fail("INVALID_PRICE");
  const found = locateVariant(data.products, input.variantId);
  if (!found) return fail("VARIANT_NOT_FOUND");
  if (found.variant.stock < input.qty) return fail("INSUFFICIENT_STOCK");

  const number = nextOrderNumber(data.orders);
  const item: OrderItem = {
    productId: found.product.id,
    variantId: found.variant.id,
    productName: found.product.name,
    colorName: colorName(found.product, found.variant.colorId),
    size: found.variant.size,
    qty: input.qty,
    priceCentsSnapshot: input.unitPriceCents,
  };
  const order: Order = {
    id: `ord_${number.slice(3)}`,
    number,
    source: "manual",
    status: "SOLD",
    customer: { name: input.buyerName?.trim() || "Walk-in", phone: "", email: "", address: "", city: "" },
    notes: input.note?.trim() ?? "",
    items: [item],
    shippingCents: 0,
    totalCents: input.unitPriceCents * input.qty,
    createdAt: now,
    emailConfirmedAt: null,
    soldAt: now,
    cancelledAt: null,
    cancelReason: null,
    timeline: [{ at: now, type: "manual_sale", actor: "owner", note: input.note?.trim() || undefined }],
  };
  return changeStock(
    { ...data, orders: [...data.orders, order] },
    found.variant.id,
    -input.qty,
    { reason: "sale", orderId: order.id },
    now,
  );
}

/* ---------- products ---------- */

export type QuickStatus = "available" | "sold_out" | "draft";

/** Which of the three quick states a product is in right now ("low" counts as available). */
export function quickStatusOf(product: Product, defaultThreshold: number): QuickStatus {
  const { kind } = deriveProductStatus(product, defaultThreshold);
  return kind === "draft" ? "draft" : kind === "sold_out" ? "sold_out" : "available";
}

/** A product with no stock cannot be made available; add stock first. */
export function canMakeAvailable(product: Product): boolean {
  return productTotalStock(product) > 0;
}

export function setProductStatus(
  data: AdminData,
  productId: string,
  target: QuickStatus,
  now: string,
): Result<AdminData> {
  const product = data.products.find((p) => p.id === productId);
  if (!product) return fail("PRODUCT_NOT_FOUND");
  if (target === "available" && !canMakeAvailable(product)) return fail("NO_STOCK");
  const patch: Partial<Product> =
    target === "available"
      ? { status: "active", forceSoldOut: false }
      : target === "sold_out"
        ? { status: "active", forceSoldOut: true }
        : { status: "draft" };
  return ok({
    ...data,
    products: data.products.map((p) => (p.id === productId ? { ...p, ...patch, updatedAt: now } : p)),
  });
}

export function upsertProduct(data: AdminData, product: Product, now: string): AdminData {
  const exists = data.products.some((p) => p.id === product.id);
  const saved = { ...product, updatedAt: now };
  return {
    ...data,
    products: exists ? data.products.map((p) => (p.id === product.id ? saved : p)) : [saved, ...data.products],
  };
}

/**
 * Saves the product form. Stock edits are never silent: every changed colour x size cell
 * writes a stock movement (reason "initial" for a new cell, "manual_adjust" for an edited one),
 * and variants removed from the product are zeroed in the log first, so the log always adds up.
 */
export function saveProduct(data: AdminData, product: Product, now: string): Result<AdminData> {
  if (data.products.some((p) => p.id !== product.id && p.slug === product.slug)) return fail("SLUG_TAKEN");
  if (!Number.isInteger(product.priceCents) || product.priceCents < 0) return fail("INVALID_PRICE");
  if (product.variants.some((v) => !Number.isInteger(v.stock) || v.stock < 0)) return fail("INVALID_QUANTITY");

  const existing = data.products.find((p) => p.id === product.id);
  const targets = new Map(product.variants.map((v) => [v.id, v.stock]));
  const known = new Map((existing?.variants ?? []).map((v) => [v.id, v.stock]));

  let next = data;
  for (const [id, stock] of known) {
    if (targets.has(id) || stock === 0) continue;
    const r = changeStock(next, id, -stock, { reason: "manual_adjust", note: "Removed in product form" }, now);
    if (!r.ok) return r;
    next = r.data;
  }

  next = upsertProduct(next, { ...product, variants: product.variants.map((v) => ({ ...v, stock: known.get(v.id) ?? 0 })) }, now);

  for (const v of product.variants) {
    const before = known.get(v.id) ?? 0;
    if (v.stock === before) continue;
    const r = changeStock(
      next,
      v.id,
      v.stock - before,
      known.has(v.id)
        ? { reason: "manual_adjust", note: "Edited in product form" }
        : { reason: "initial", note: "Added in product form" },
      now,
    );
    if (!r.ok) return r;
    next = r.data;
  }
  return ok(next);
}

export function uniqueSlug(base: string, takenSlugs: string[]): string {
  const root = slugify(base);
  if (!takenSlugs.includes(root)) return root;
  let n = 2;
  while (takenSlugs.includes(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

/** Copy with no stock, as a draft, so nothing goes live by accident. */
export function duplicateProduct(data: AdminData, productId: string, newId: string, now: string): Result<AdminData> {
  const source = data.products.find((p) => p.id === productId);
  if (!source) return fail("PRODUCT_NOT_FOUND");
  const copy: Product = {
    ...source,
    id: newId,
    name: `${source.name} (copy)`,
    slug: uniqueSlug(`${source.slug}-copy`, data.products.map((p) => p.slug)),
    status: "draft",
    forceSoldOut: false,
    variants: generateVariants(newId, source.colors, source.sizes),
    createdAt: now,
    updatedAt: now,
  };
  return ok({ ...data, products: [copy, ...data.products] });
}

export function deleteProduct(data: AdminData, productId: string): Result<AdminData> {
  if (!data.products.some((p) => p.id === productId)) return fail("PRODUCT_NOT_FOUND");
  return ok({ ...data, products: data.products.filter((p) => p.id !== productId) });
}

/* ---------- read helpers for lists / dashboard ---------- */

export function countNeedsAction(orders: Order[]): number {
  return orders.filter((o) => o.status === "AWAITING_APPROVAL").length;
}

/** Orders that are still open (waiting for the customer's email or for the owner's decision). */
export function openOrdersForProduct(data: AdminData, productId: string): Order[] {
  return data.orders.filter(
    (o) =>
      (o.status === "PENDING_EMAIL" || o.status === "AWAITING_APPROVAL") &&
      o.items.some((i) => i.productId === productId),
  );
}

export function lowStockProducts(data: AdminData): Product[] {
  return data.products.filter((p) => deriveProductStatus(p, data.settings.lowStockThreshold).kind === "low");
}

/* ---------- restock (A4) ---------- */

export interface RestockLine {
  variantId: string;
  add: number;
}

/**
 * Adds pieces to several colour/size cells of ONE product in a single step, all or nothing.
 * Lines with add = 0 are ignored; every other line is logged as a manual adjustment.
 */
export function restockProduct(
  data: AdminData,
  productId: string,
  lines: RestockLine[],
  note: string,
  now: string,
): Result<AdminData> {
  const product = data.products.find((p) => p.id === productId);
  if (!product) return fail("PRODUCT_NOT_FOUND");
  if (lines.some((l) => !Number.isInteger(l.add) || l.add < 0)) return fail("INVALID_QUANTITY");
  const wanted = lines.filter((l) => l.add > 0);
  if (wanted.length === 0) return fail("NO_CHANGE");
  if (wanted.some((l) => !product.variants.some((v) => v.id === l.variantId))) return fail("VARIANT_NOT_FOUND");

  let next = data;
  for (const line of wanted) {
    const r = changeStock(next, line.variantId, line.add, { reason: "manual_adjust", note: note.trim() || "Restock" }, now);
    if (!r.ok) return r;
    next = r.data;
  }
  return ok(next);
}

/* ---------- removing colours or sizes that open orders still use (A5) ---------- */

export interface AffectedOrder {
  orderId: string;
  orderNumber: string;
  /** e.g. "Oversized Tee · Black · L × 2" */
  items: string[];
}

/**
 * Open orders (waiting for the customer's email, or for your decision) that contain a colour/size
 * variant which `next` no longer has. Saving would leave such an order unsellable.
 */
export function openOrdersLosingVariants(data: AdminData, productId: string, next: Product): AffectedOrder[] {
  const existing = data.products.find((p) => p.id === productId);
  if (!existing) return [];
  const kept = new Set(next.variants.map((v) => v.id));
  const removed = new Set(existing.variants.filter((v) => !kept.has(v.id)).map((v) => v.id));
  if (removed.size === 0) return [];
  const out: AffectedOrder[] = [];
  for (const order of data.orders) {
    if (order.status !== "PENDING_EMAIL" && order.status !== "AWAITING_APPROVAL") continue;
    const hit = order.items.filter((i) => removed.has(i.variantId));
    if (hit.length === 0) continue;
    out.push({
      orderId: order.id,
      orderNumber: order.number,
      items: hit.map((i) => `${i.productName} · ${i.colorName} · ${i.size} × ${i.qty}`),
    });
  }
  return out;
}
