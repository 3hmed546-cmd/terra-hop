import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type Variant = "primary" | "secondary";

// Uses semantic variables, so the same Button works on light and inside .on-dark.
const base =
  "inline-flex h-12 min-w-12 items-center justify-center rounded-control px-6 text-sm font-semibold uppercase tracking-[0.12em] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40";
const variants: Record<Variant, string> = {
  primary: "bg-(--fg) text-(--bg) hover:bg-(--hover) disabled:hover:bg-(--fg)",
  secondary: "border border-(--border) bg-transparent text-(--fg) hover:border-(--fg)",
};

type ButtonProps = ComponentPropsWithoutRef<"button"> & { variant?: Variant };
export function Button({ variant = "primary", className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & { variant?: Variant };
export function ButtonLink({ variant = "primary", className = "", ...props }: ButtonLinkProps) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
