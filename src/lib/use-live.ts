"use client";

import { useSyncExternalStore, useEffect } from "react";

export type Topic = "media" | "products" | "settings" | "content";

interface LiveState {
  revisions: Record<Topic, number>;
  siteData: any | null;
  productsData: any[] | null;
  connected: boolean;
}

const state: LiveState = {
  revisions: {
    media: 0,
    products: 0,
    settings: 0,
    content: 0,
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
let isChecking = false;
let pollTimer: NodeJS.Timeout | null = null;
let broadcastChannel: BroadcastChannel | null = null;

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

export function handleTopicChange(topic: Topic, newRev?: number) {
  if (typeof newRev === "number") {
    state.revisions[topic] = newRev;
  }

  if (topic === "media" || topic === "settings" || topic === "content") {
    fetchSiteData();
  } else if (topic === "products") {
    fetchProductsData();
  }
}

async function checkVersion() {
  if (isChecking) return;
  isChecking = true;
  try {
    const res = await fetch(`/api/public/version?_t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      const payload = await res.json();
      if (payload.ok && payload.data) {
        state.connected = true;
        const v = payload.data;
        for (const key of ["media", "products", "settings", "content"] as Topic[]) {
          if (typeof v[key] === "number") {
            if (state.revisions[key] === 0) {
              state.revisions[key] = v[key];
            } else if (v[key] > state.revisions[key]) {
              handleTopicChange(key, v[key]);
            }
          }
        }
      }
    }
  } catch {} finally {
    isChecking = false;
  }
}

export function broadcastLiveChange(topic: Topic, revision?: number) {
  try {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      const bc = new BroadcastChannel("terra_live_updates");
      bc.postMessage({ topic, revision: revision || Date.now() });
      bc.close();
    }
  } catch {}
}

function initLiveEngine() {
  if (typeof window === "undefined" || isInitialized) return;
  isInitialized = true;

  // Cross-tab instant synchronization within the same browser
  try {
    if ("BroadcastChannel" in window) {
      broadcastChannel = new BroadcastChannel("terra_live_updates");
      broadcastChannel.onmessage = (event) => {
        const { topic, revision } = event.data || {};
        if (topic) {
          handleTopicChange(topic, revision);
        } else {
          fetchSiteData();
          fetchProductsData();
        }
      };
    }
  } catch {}

  // Initial immediate data & version fetch
  fetchSiteData();
  fetchProductsData();
  checkVersion();

  // Rapid 2.5s version check when the tab is visible for true real-time live feel
  // (2ms execution per check, lightweight and non-blocking on cPanel Phusion Passenger)
  pollTimer = setInterval(() => {
    if (typeof document !== "undefined" && !document.hidden) {
      checkVersion();
    }
  }, 2500);

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

export function useLive<T = any>(
  topic: Topic,
  fallback?: T
): { data: T | null; connected: boolean; revision: number } {
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
