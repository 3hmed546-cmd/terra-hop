"use client";

import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from "react";
import { translations, type Locale, type Translations } from "./translations";

interface LocaleContextType {
  locale: Locale;
  dir: "rtl" | "ltr";
  t: Translations;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

const LocaleContext = createContext<LocaleContextType | null>(null);

const STORAGE_KEY = "terra_hop_locale";

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Default to Arabic as requested by the user, but check localStorage on client mount
  const [locale, setLocaleState] = useState<Locale>("ar");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved === "ar" || saved === "en") {
        setLocaleState(saved);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Storefront layout direction is locked to LTR so grids, logos, and columns never flip horizontally.
  const dir: "rtl" | "ltr" = "ltr";

  // Keep document html lang in sync while locking storefront direction to LTR
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dir = "ltr";
    }
  }, [locale]);

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    try {
      localStorage.setItem(STORAGE_KEY, nextLocale);
    } catch {
      // Ignore localStorage errors
    }
  };

  const toggleLocale = () => {
    setLocale(locale === "ar" ? "en" : "ar");
  };

  const t = useMemo(() => translations[locale], [locale]);

  const value = useMemo(
    () => ({
      locale,
      dir,
      t,
      setLocale,
      toggleLocale,
    }),
    [locale, dir, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Fallback for SSR or non-provider components
    return {
      locale: "ar" as Locale,
      dir: "rtl" as const,
      t: translations.ar,
      setLocale: () => {},
      toggleLocale: () => {},
    };
  }
  return ctx;
}
