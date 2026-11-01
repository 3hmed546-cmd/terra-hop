import type { ComponentPropsWithoutRef } from "react";

export function Label({ className = "", ...props }: ComponentPropsWithoutRef<"label">) {
  return <label className={`block text-sm font-semibold text-(--fg) ${className}`} {...props} />;
}
