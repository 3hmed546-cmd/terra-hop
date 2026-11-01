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
    const res = await fetch("/api/public/site", { cache: "no-store" });
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
    const res = await fetch("/api/public/products", { cache: "no-store" });
    if (res.ok) {
      const payload = await res.json();
      if (payload.ok && payload.data) {
        state.productsData = payload.data;
        notify();
      }
    }
  } catch {}
}

function handleTopicChange(topic: Topic, newRev: number) {
  if (state.revisions[topic] === newRev) return;
  state.revisions[topic] = newRev;

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

  function connectSSE() {
    try {
      if (eventSource) eventSource.close();
      const es = new EventSource("/api/public/stream");
      eventSource = es;

      es.addEventListener("ready", (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          state.connected = true;
          if (parsed.revisions) {
            Object.assign(state.revisions, parsed.revisions);
          }
          notify();
        } catch {}
      });

      es.addEventListener("change", (e: MessageEvent) => {
        try {
          const change = JSON.parse(e.data);
          if (change.topic && typeof change.revision === "number") {
            handleTopicChange(change.topic as Topic, change.revision);
          }
        } catch {}
      });

      es.onerror = () => {
        state.connected = false;
        notify();
        es.close();
        // Fallback polling will kick in, try reconnecting SSE in 10s
        setTimeout(connectSSE, 10000);
      };
    } catch {
      // If SSE not supported, rely on polling
    }
  }

  connectSSE();

  // Polling fallback check every 20 seconds
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch("/api/public/version", { cache: "no-store" });
      if (res.ok) {
        const payload = await res.json();
        if (payload.ok && payload.data) {
          const v = payload.data;
          for (const key of ["media", "products", "settings", "content"] as Topic[]) {
            if (typeof v[key] === "number" && v[key] > state.revisions[key]) {
              handleTopicChange(key, v[key]);
            }
          }
        }
      }
    } catch {}
  }, 20000);

  // When tab becomes visible again, check version immediately
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      fetchSiteData();
      fetchProductsData();
    }
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
