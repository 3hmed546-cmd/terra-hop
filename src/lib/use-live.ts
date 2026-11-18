"use client";

import { useSyncExternalStore, useEffect, useState } from "react";

type Topic = "media" | "products" | "settings" | "content";

interface LiveState {
  revisions: Record<Topic, number>;
  siteData: any | null;
  productsData: any[] | null;
  connected: boolean;
}

const state: LiveState = {
  revisions: {
    media: 1,
    products: 1,
    settings: 1,
    content: 1,
  },
  siteData: null,
  productsData: null,
  connected: false,
};

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

let isInitialized = false;
let eventSource: EventSource | null = null;
let pollTimer: NodeJS.Timeout | null = null;

async function fetchSiteData() {
  try {
    const res = await fetch(`/api/public/site?_t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      const payload = await res.json();
      if (payload.ok && payload.data) {
        state.siteData = payload.data;
        notify();
      }
    }
  } catch {}
}

async function fetchProductsData() {
  try {
    const res = await fetch(`/api/public/products?_t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      const payload = await res.json();
      if (payload.ok && payload.data) {
        state.productsData = payload.data;
        notify();
      }
    }
  } catch {}
}

function handleTopicChange(topic: Topic, newRev?: number) {
  if (typeof newRev === "number") {
    state.revisions[topic] = newRev;
  }

  if (topic === "media" || topic === "settings" || topic === "content") {
    fetchSiteData();
  } else if (topic === "products") {
    fetchProductsData();
  }
}

function initLiveEngine() {
  if (typeof window === "undefined" || isInitialized) return;
  isInitialized = true;

  // Initial data fetch
  fetchSiteData();
  fetchProductsData();

  async function checkVersion() {
    try {
      const res = await fetch("/api/public/version", { cache: "no-store" });
      if (res.ok) {
        const payload = await res.json();
        if (payload.ok && payload.data) {
          state.connected = true;
          const v = payload.data;
          for (const key of ["media", "products", "settings", "content"] as Topic[]) {
            if (typeof v[key] === "number" && v[key] > state.revisions[key]) {
              handleTopicChange(key, v[key]);
            }
          }
          notify();
        }
      }
    } catch {}
  }

  // Lightweight, non-blocking check every 12 seconds.
  // Releases the Passenger worker instantly (2ms execution) without hogging server concurrency.
  pollTimer = setInterval(() => {
    if (typeof document !== "undefined" && !document.hidden) {
      checkVersion();
    }
  }, 12000);

  // When tab becomes visible or focused, check version immediately
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkVersion();
    }
  });

  window.addEventListener("focus", () => {
    checkVersion();
  });
}

export function useLive<T = any>(topic: Topic, fallback?: T): { data: T | null; connected: boolean; revision: number } {
  useEffect(() => {
    initLiveEngine();
  }, []);

  const snapshot = useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => {
      if (topic === "products") {
        return state.productsData || fallback || null;
      }
      return state.siteData || fallback || null;
    },
    () => fallback || null
  );

  return {
    data: snapshot,
    connected: state.connected,
    revision: state.revisions[topic],
  };
}
