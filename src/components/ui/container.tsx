import type { ComponentPropsWithoutRef } from "react";

// Max 1280 px. Gutters 16 / 24 / 40 px. Grid: 4 columns, 8 from 768 px, 12 from 1024 px.
export function Container({ className = "", ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={`mx-auto w-full max-w-[1280px] px-4 md:px-6 lg:px-10 ${className}`} {...props} />;
}

export function Grid({ className = "", ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={`grid grid-cols-4 gap-x-4 md:grid-cols-8 md:gap-x-6 lg:grid-cols-12 ${className}`} {...props} />;
}
