"use client";

import { useSyncExternalStore } from "react";
import { apiFetch, isAuthenticated } from "../admin-auth";
import type { AdminData, ErrorCode, Product, Result, Settings, Order, StockMovement } from "./types";
import { DEFAULT_SETTINGS, createSeedData } from "./seed";
import {
  adjustStock as pureAdjustStock,
  canMakeAvailable,
  cancelOrder as pureCancelOrder,
  deleteProduct as pureDeleteProduct,
  duplicateProduct as pureDuplicateProduct,
  recordManualSale as pureRecordManualSale,
  restockProduct as pureRestockProduct,
  saveProduct as pureSaveProduct,
  sellOrder as pureSellOrder,
  type ManualSaleInput,
  type RestockLine,
  type QuickStatus,
} from "./inventory";

let state: AdminData | null = null;
const listeners = new Set<() => void>();
let isFetching = false;
let eventSource: EventSource | null = null;

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

async function fetchServerOrders(): Promise<{ ok: boolean; orders: Order[] }> {
  try {
    const res = await apiFetch("/api/admin/orders", { cache: "no-store" });
    if (!res.ok) return { ok: false, orders: [] };
    const payload = await res.json();
    return { ok: true, orders: payload?.data?.orders || [] };
  } catch {
    return { ok: false, orders: [] };
  }
}

async function fetchServerProducts(): Promise<{ ok: boolean; products: Product[] }> {
  try {
    const res = await apiFetch("/api/admin/products", { cache: "no-store" });
    if (!res.ok) return { ok: false, products: [] };
    const payload = await res.json();
    return { ok: true, products: payload?.data || [] };
  } catch {
    return { ok: false, products: [] };
  }
}

async function fetchServerSettings(): Promise<Settings> {
  try {
    const res = await apiFetch("/api/admin/settings", { cache: "no-store" });
    if (!res.ok) return DEFAULT_SETTINGS;
    const payload = await res.json();
    return { ...DEFAULT_SETTINGS, ...(payload?.data || {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function reloadAdminData() {
  if (isFetching) return;
  isFetching = true;

  try {
    const [prodRes, orderRes, settings] = await Promise.all([
      fetchServerProducts(),
      fetchServerOrders(),
      fetchServerSettings(),
    ]);

    if (prodRes.ok || orderRes.ok) {
      state = {
        products: prodRes.ok ? prodRes.products : (state?.products || []),
        orders: orderRes.ok ? orderRes.orders : (state?.orders || []),
        movements: state?.movements || [],
        settings,
      };
      emit();
    }
  } finally {
    isFetching = false;
  }
}

function initLiveAdminSync() {
  if (typeof window === "undefined" || eventSource) return;

  try {
    const es = new EventSource("/api/public/stream");
    eventSource = es;

    es.addEventListener("change", (e: MessageEvent) => {
      try {
        const change = JSON.parse(e.data);
        if (["products", "orders", "settings"].includes(change.topic)) {
          reloadAdminData();
        }
      } catch {}
    });

    es.onerror = () => {
      es.close();
      eventSource = null;
      setTimeout(initLiveAdminSync, 10000);
    };
  } catch {}
}

function getSnapshot(): AdminData | null {
  if (typeof window === "undefined") return null;
  if (state === null) {
    // Initial empty state before server authoritative data returns
    state = {
      products: [],
      orders: [],
      movements: [],
      settings: DEFAULT_SETTINGS,
    };
    reloadAdminData();
    initLiveAdminSync();
  }
  return state;
}

function getServerSnapshot(): AdminData | null {
  return null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type ActionResult = { ok: true } | { ok: false; error: ErrorCode };

function run(fn: (data: AdminData, now: string) => Result<AdminData>): ActionResult {
  const current = getSnapshot();
  if (!current) return { ok: false, error: "NO_CHANGE" };
  const now = new Date().toISOString();
  const result = fn(current, now);
  if (!result.ok) return result;
  state = result.data;
  emit();
  return { ok: true };
}

export const adminActions = {
  sellOrder: (orderId: string, deliveryDays?: string): ActionResult => {
    const res = run((d, now) => pureSellOrder(d, orderId, now));
    if (res.ok) {
      apiFetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "SOLD", deliveryDays: deliveryDays || "من 2 إلى 4 أيام عمل" }),
      }).then(() => reloadAdminData()).catch(() => {});
    }
    return res;
  },

  cancelOrder: (orderId: string, reason: string): ActionResult => {
    const res = run((d, now) => pureCancelOrder(d, orderId, reason, now));
    if (res.ok) {
      apiFetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "CANCELLED", reason }),
      }).then(() => reloadAdminData()).catch(() => {});
    }
    return res;
  },

  recordSale: (input: ManualSaleInput): { ok: true; orderId: string; orderNumber: string } | { ok: false; error: ErrorCode } => {
    const current = getSnapshot();
    if (!current) return { ok: false, error: "NO_CHANGE" };
    const now = new Date().toISOString();
    const result = pureRecordManualSale(current, input, now);
    if (!result.ok) return result;
    state = result.data;
    emit();
    const created = result.data.orders[result.data.orders.length - 1]!;

    apiFetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: {
          name: input.buyerName?.trim() || "بيع يدوي (Manual Sale)",
          phone: "01000000000",
          city: "المتجر",
          address: "بيع مباشر",
        },
        items: [
          {
            variantId: input.variantId,
            qty: input.qty,
          },
        ],
        notes: input.note,
      }),
    }).then(() => reloadAdminData()).catch(() => {});

    return { ok: true, orderId: created.id, orderNumber: created.number };
  },

  restockProduct: (productId: string, lines: RestockLine[], note: string): ActionResult => {
    const res = run((d, now) => pureRestockProduct(d, productId, lines, note, now));
    if (res.ok) {
      for (const line of lines) {
        apiFetch(`/api/admin/products/${productId}/stock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantId: line.variantId, delta: line.add, note }),
        }).catch(() => {});
      }
    }
    return res;
  },

  adjustStock: (variantId: string, newStock: number, note: string): ActionResult => {
    const current = state?.products || [];
    const prod = current.find((p) => p.variants?.some((v: any) => v.id === variantId));
    const res = run((d, now) => pureAdjustStock(d, variantId, newStock, note, now));
    if (res.ok && prod) {
      apiFetch(`/api/admin/products/${prod.id}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, stock: newStock, note }),
      }).then(() => reloadAdminData()).catch(() => {});
    }
    return res;
  },

  setProductStatusAsync: async (productId: string, target: QuickStatus): Promise<ActionResult> => {
    const current = getSnapshot();
    const product = current?.products.find((item) => item.id === productId);
    if (!product) return { ok: false, error: "PRODUCT_NOT_FOUND" };
    if (target === "available" && !canMakeAvailable(product)) return { ok: false, error: "NO_STOCK" };

    // Optimistic in-memory update so UI never reverts or lags
    const patch: Partial<Product> =
      target === "available"
        ? { status: "active", forceSoldOut: false }
        : target === "sold_out"
          ? { status: "active", forceSoldOut: true }
          : { status: "draft" };

    if (state) {
      state = {
        ...state,
        products: state.products.map((p) => (p.id === productId ? { ...p, ...patch } : p)),
      };
      emit();
    }

    try {
      const response = await apiFetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: target === "draft" ? "draft" : "active",
          forceSoldOut: target === "sold_out",
          ifRevision: product.revision,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        // Rollback on server failure
        if (state) {
          state = {
            ...state,
            products: state.products.map((p) => (p.id === productId ? product : p)),
          };
          emit();
        }
        return { ok: false, error: "NO_CHANGE" };
      }
      await reloadAdminData();
      return { ok: true };
    } catch {
      if (state) {
        state = {
          ...state,
          products: state.products.map((p) => (p.id === productId ? product : p)),
        };
        emit();
      }
      return { ok: false, error: "NO_CHANGE" };
    }
  },

  saveProduct: async (product: Product): Promise<ActionResult> => {
    const current = getSnapshot();
    if (!current) return { ok: false, error: "NO_CHANGE" };

    const payload = {
      slug: product.slug,
      nameAr: product.name,
      nameEn: product.name,
      category: product.category,
      priceCents: product.priceCents,
      compareAtCents: product.compareAtCents,
      status: product.status,
      forceSoldOut: product.forceSoldOut,
      lowStockThreshold: product.lowStockThreshold,
      ifRevision: product.revision,
      descriptionAr: product.description,
      details: product.details,
      colors: product.colors,
      variants: product.variants,
      images: product.images,
    };

    try {
      const exists = current.products.some((item) => item.id === product.id);
      let response: Response;
      if (exists) {
        response = await apiFetch(`/api/admin/products/${encodeURIComponent(product.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const created = await apiFetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const createdPayload = await created.json().catch(() => null);
        if (!created.ok || !createdPayload?.ok || !createdPayload.data?.id) {
          return { ok: false, error: "NO_CHANGE" };
        }
        response = await apiFetch(`/api/admin/products/${encodeURIComponent(createdPayload.data.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const responsePayload = await response.json().catch(() => null);
      if (!response.ok || !responsePayload?.ok) return { ok: false, error: "NO_CHANGE" };
      await reloadAdminData();
      return { ok: true };
    } catch {
      return { ok: false, error: "NO_CHANGE" };
    }
  },

  duplicateProduct: (productId: string, newId: string): ActionResult => {
    const res = run((d, now) => pureDuplicateProduct(d, productId, newId, now));
    if (res.ok) {
      const existing = state?.products.find((p) => p.id === productId);
      if (existing) {
        apiFetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nameAr: `${existing.name} (نسخة)`,
            priceCents: existing.priceCents,
            category: existing.category,
            descriptionAr: existing.description,
          }),
        }).then(() => reloadAdminData()).catch(() => {});
      }
    }
    return res;
  },

  deleteProduct: (productId: string): ActionResult => {
    const res = run((d) => pureDeleteProduct(d, productId));
    if (res.ok) {
      apiFetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
      }).then(() => reloadAdminData()).catch(() => {});
    }
    return res;
  },

  updateSettings: async (patch: Partial<Settings>): Promise<ActionResult> => {
    try {
      const responses = await Promise.all(
        Object.entries(patch).map(async ([key, value]) => {
          const response = await apiFetch("/api/admin/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ groupKey: "store", key, value }),
          });
          const payload = await response.json().catch(() => null);
          return response.ok && payload?.ok;
        }),
      );
      if (responses.some((ok) => !ok)) return { ok: false, error: "NO_CHANGE" };
      await reloadAdminData();
      return { ok: true };
    } catch {
      return { ok: false, error: "NO_CHANGE" };
    }
  },

  simulateOrder: (kind: string): { ok: true; number: string } | { ok: false; error: ErrorCode } => {
    return { ok: true, number: `TH-${Math.floor(100000 + Math.random() * 900000)}` };
  },

  confirmOrderEmail: (orderId: string): ActionResult => ({ ok: true }),
  expireOrder: (orderId: string): ActionResult => ({ ok: true }),
  resetDemo: (): ActionResult => ({ ok: true }),
  checkoutWebsiteOrder: (input: any) => ({ ok: true as const, order: null }),
};

export function useAdminStore() {
  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    data,
    ready: data !== null,
    actions: adminActions,
    storageProblem: false,
    reload: reloadAdminData,
  };
}
