"use client";

import { useEffect, useState } from "react";

export type CheckoutConfig = {
  currency: string;
  shippingCents: number;
  freeShippingMinQuantity: number;
  freeShippingMinAmountCents: number;
  paymentMethods: string[];
};

const DEFAULT_CONFIG: CheckoutConfig = {
  currency: "EGP",
  shippingCents: 6000,
  freeShippingMinQuantity: 2,
  freeShippingMinAmountCents: 0,
  paymentMethods: ["cod"],
};

export function useCheckoutConfig(): CheckoutConfig {
  const [config, setConfig] = useState<CheckoutConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    let active = true;
    fetch("/api/public/checkout-config", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active && json?.ok && json?.data) {
          setConfig((prev) => ({ ...prev, ...json.data }));
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  return config;
}
