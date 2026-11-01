"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";

interface ToastItem {
  id: number;
  message: string;
}

const ToastContext = createContext<{ push: (message: string) => void } | null>(null);

const DURATION_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string) => {
      const id = nextId.current++;
      setItems((list) => [...list, { id, message }]);
      timers.current.set(id, setTimeout(() => dismiss(id), DURATION_MS));
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* The live region stays mounted so screen readers announce each new message. */}
      <div className="adm-toasts" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} className="adm-toast">
            <span>{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)}>
              {ADMIN_STRINGS.common.dismiss}
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
