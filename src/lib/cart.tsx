"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";

export type CartLine = { slug: string; size: string; qty: number };
type State = { lines: CartLine[]; ready: boolean };
type Action =
  | { type: "load"; lines: CartLine[] }
  | { type: "add"; slug: string; size: string }
  | { type: "qty"; slug: string; size: string; qty: number }
  | { type: "remove"; slug: string; size: string }
  | { type: "clear" };

const KEY = "terra-hop-cart";
const MAX_QTY = 10;
const same = (l: CartLine, slug: string, size: string) => l.slug === slug && l.size === size;

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case "load":
      return { lines: a.lines, ready: true };
    case "add": {
      const found = state.lines.some((l) => same(l, a.slug, a.size));
      const lines = found
        ? state.lines.map((l) => (same(l, a.slug, a.size) ? { ...l, qty: Math.min(l.qty + 1, MAX_QTY) } : l))
        : [...state.lines, { slug: a.slug, size: a.size, qty: 1 }];
      return { ...state, lines };
    }
    case "qty":
      return {
        ...state,
        lines: state.lines
          .map((l) => (same(l, a.slug, a.size) ? { ...l, qty: Math.min(a.qty, MAX_QTY) } : l))
          .filter((l) => l.qty > 0),
      };
    case "remove":
      return { ...state, lines: state.lines.filter((l) => !same(l, a.slug, a.size)) };
    case "clear":
      return { ...state, lines: [] };
  }
}

type CartApi = {
  lines: CartLine[];
  ready: boolean;
  count: number;
  add: (slug: string, size: string) => void;
  setQty: (slug: string, size: string, qty: number) => void;
  remove: (slug: string, size: string) => void;
  clear: () => void;
};
const CartContext = createContext<CartApi | null>(null);

function parse(raw: string | null): CartLine[] {
  try {
    const data: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(data)) return [];
    return data.filter(
      (l): l is CartLine => typeof l?.slug === "string" && typeof l?.size === "string" && Number.isInteger(l?.qty) && l.qty > 0,
    );
  } catch {
    return [];
  }
}

// Preview cart: lives in the browser only (localStorage). Nothing is sent anywhere.
export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { lines: [], ready: false });
  const skipFirstSave = useRef(true);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(KEY);
    } catch {}
    dispatch({ type: "load", lines: parse(raw) });
  }, []);

  useEffect(() => {
    if (!state.ready) return;
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(state.lines));
    } catch {}
  }, [state]);

  const api = useMemo<CartApi>(
    () => ({
      lines: state.lines,
      ready: state.ready,
      count: state.lines.reduce((n, l) => n + l.qty, 0),
      add: (slug, size) => dispatch({ type: "add", slug, size }),
      setQty: (slug, size, qty) => dispatch({ type: "qty", slug, size, qty }),
      remove: (slug, size) => dispatch({ type: "remove", slug, size }),
      clear: () => dispatch({ type: "clear" }),
    }),
    [state.lines, state.ready],
  );
  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
