import type { ComponentPropsWithoutRef } from "react";

// Text only. Status is never conveyed by color.
export function StatusLabel({ className = "", ...props }: ComponentPropsWithoutRef<"span">) {
  return <span className={`text-label text-(--fg-muted) ${className}`} {...props} />;
}
