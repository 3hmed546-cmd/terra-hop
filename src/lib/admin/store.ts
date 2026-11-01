"use client";
/**
 * Client-side store for the preview phase: AdminData kept in memory and mirrored to
 * localStorage. When the backend arrives (B2/B4) only this file's actions change
 * (they call the API instead of the pure functions); screens keep using the hook.
 */
import { useSyncExternalStore } from "react";
import {
  adjustStock,
  cancelOrder,
  createWebsiteCheckoutOrder,
  deleteProduct,
  recordManualSale,
  restockProduct,
  sellOrder,
  setProductStatus,
  duplicateProduct,
  saveProduct,
  type ManualSaleInput,
  type RestockLine,
  type QuickStatus,
  type WebsiteCheckoutInput,
} from "./inventory";
import { confirmOrderEmail, expireOrder, simulateWebsiteOrder, type SimulatedKind } from "./orders";
import { createSeedData, DEFAULT_SETTINGS } from "./seed";
import { isAuthenticated } from "../admin-auth";
import type { AdminData, ErrorCode, Product, Result, Settings } from "./types";

const STORAGE_KEY = "terra-hop-admin-preview";
const VERSION = 3;

let state: AdminData | null = null;
/** True when the last attempt to save to localStorage failed (full or blocked). */
let storageFailed = false;
const listeners = new Set<() => void>();

function isValid(value: unknown): value is AdminData {
  const v = value as AdminData | null;
  return !!v && Array.isArray(v.products) && Array.isArray(v.orders) && Array.isArray(v.movements) && !!v.settings;
}

function load(): AdminData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { version?: number; data?: unknown };
      if (parsed.version === VERSION && isValid(parsed.data)) {
        // Data saved by an older phase may lack newer settings: fill them from the defaults.
        const fullData = { ...parsed.data, settings: { ...DEFAULT_SETTINGS, ...parsed.data.settings } };
        // IDOR & Privacy Protection: If user is not authenticated as admin, do not load admin customer orders
        if (!isAuthenticated()) {
          return { ...fullData, orders: [] };
        }
        return fullData;
      }
    }
  } catch {
    /* unreadable or blocked storage: fall back to demo data */
  }

  const seed = createSeedData();
  // Privacy & IDOR Shield: Never seed full customer orders into public visitors' browser storage
  if (!isAuthenticated()) {
    return { ...seed, orders: [] };
  }
  return seed;
}

function persist(data: AdminData): void {
  try {
    // Only persist full orders array if authenticated as admin
    const dataToSave = isAuthenticated() ? data : { ...data, orders: [] };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, data: dataToSave }));
    storageFailed = false;
  } catch {
    /* storage full or blocked: keep working in memory, and let the shell say so */
    storageFailed = true;
  }
}

function emit(): void {
  listeners.forEach((l) => l());
}

function getSnapshot(): AdminData | null {
  if (typeof window === "undefined") return null;
  if (state === null) state = load();
  return state;
}

function getServerSnapshot(): AdminData | null {
  return null;
}

function getStorageFailed(): boolean {
  return storageFailed;
}

function getStorageFailedServer(): boolean {
  return false;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      state = load();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function commit(next: AdminData): void {
  state = next;
  persist(next);
  emit();
}

export type ActionResult = { ok: true } | { ok: false; error: ErrorCode };

function run(fn: (data: AdminData, now: string) => Result<AdminData>): ActionResult {
  const current = getSnapshot();
  if (!current) return { ok: false, error: "NO_CHANGE" };
  const result = fn(current, new Date().toISOString());
  if (!result.ok) return result;
  commit(result.data);
  return { ok: true };
}

export const adminActions = {
  sellOrder: (orderId: string) => run((d, now) => sellOrder(d, orderId, now)),
  cancelOrder: (orderId: string, reason: string) => run((d, now) => cancelOrder(d, orderId, reason, now)),
  /** Creates a SOLD order with source "manual". Returns the new order id so the page can open it. */
  recordSale: (input: ManualSaleInput): { ok: true; orderId: string; orderNumber: string } | { ok: false; error: ErrorCode } => {
    const current = getSnapshot();
    if (!current) return { ok: false, error: "NO_CHANGE" };
    const result = recordManualSale(current, input, new Date().toISOString());
    if (!result.ok) return result;
    commit(result.data);
    const created = result.data.orders[result.data.orders.length - 1]!;
    return { ok: true, orderId: created.id, orderNumber: created.number };
  },
  checkoutWebsiteOrder: (input: WebsiteCheckoutInput) => {
    const current = getSnapshot();
    if (!current) return { ok: false as const, error: "NO_CHANGE" as const, order: null };
    const now = new Date().toISOString();
    const res = createWebsiteCheckoutOrder(current, input, now);
    commit(res.data);
    return { ok: true as const, order: res.order };
  },
  restockProduct: (productId: string, lines: RestockLine[], note: string) =>
    run((d, now) => restockProduct(d, productId, lines, note, now)),
  adjustStock: (variantId: string, newStock: number, note: string) =>
    run((d, now) => adjustStock(d, variantId, newStock, note, now)),
  setProductStatus: (productId: string, target: QuickStatus) =>
    run((d, now) => setProductStatus(d, productId, target, now)),
  saveProduct: (product: Product) => run((d, now) => saveProduct(d, product, now)),
  duplicateProduct: (productId: string, newId: string) => run((d, now) => duplicateProduct(d, productId, newId, now)),
  deleteProduct: (productId: string) => run((d) => deleteProduct(d, productId)),
  /** Preview only: the customer clicked "Confirm" in the email. */
  confirmOrderEmail: (orderId: string) => run((d, now) => confirmOrderEmail(d, orderId, now)),
  /** Preview only: 24 hours passed without the customer confirming. */
  expireOrder: (orderId: string) => run((d, now) => expireOrder(d, orderId, now)),
  /** Preview only: a customer placed an order on the website. Returns the new order number. */
  simulateOrder: (kind: SimulatedKind): { ok: true; number: string } | { ok: false; error: ErrorCode } => {
    const current = getSnapshot();
    if (!current) return { ok: false, error: "NO_CHANGE" };
    const result = simulateWebsiteOrder(current, kind, new Date().toISOString(), Date.now());
    if (!result.ok) return result;
    commit(result.data);
    return { ok: true, number: result.data.orders[result.data.orders.length - 1]!.number };
  },
  updateSettings: (patch: Partial<Settings>) =>
    run((d) => ({ ok: true, data: { ...d, settings: { ...d.settings, ...patch } } })),
  resetDemo: (): ActionResult => {
    commit(createSeedData());
    return { ok: true };
  },
};

/** `data` is null on the server and during hydration; render a skeleton until `ready`. */
export function useAdminStore() {
  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const storageProblem = useSyncExternalStore(subscribe, getStorageFailed, getStorageFailedServer);
  return { data, ready: data !== null, actions: adminActions, storageProblem };
}
