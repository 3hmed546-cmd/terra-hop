import type { ComponentPropsWithoutRef } from "react";

type TextInputProps = ComponentPropsWithoutRef<"input"> & { error?: boolean };

// Error state: 2 px border plus a text message linked by aria-describedby. Never color alone.
export function TextInput({ error = false, className = "", ...props }: TextInputProps) {
  const border = error ? "border-2 border-(--fg)" : "border border-(--border)";
  return (
    <input
      aria-invalid={error || undefined}
      className={`h-12 w-full rounded-control bg-transparent px-4 text-base text-(--fg) placeholder:text-(--fg-muted) disabled:cursor-not-allowed disabled:opacity-40 ${border} ${className}`}
      {...props}
    />
  );
}

export function FieldError({ className = "", ...props }: ComponentPropsWithoutRef<"p">) {
  return <p className={`mt-2 text-sm font-semibold text-(--fg) ${className}`} {...props} />;
}
