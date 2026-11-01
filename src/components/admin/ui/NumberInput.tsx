"use client";
import { useState } from "react";
import { Field } from "./Field";

interface Props {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  /** allow a decimal point (prices); default is whole numbers (stock, quantity) */
  decimal?: boolean;
  prefix?: string;
  suffix?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  hideLabel?: boolean;
}

function sanitize(text: string, decimal: boolean): string {
  if (!decimal) return text.replace(/\D/g, "");
  const cleaned = text.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

/** Numeric text field: mobile numeric keypad, tabular figures, no scroll-wheel surprises. */
export function NumberInput({
  label, value, onChange, min, max, decimal = false, prefix, suffix, hint, error, required, disabled, hideLabel,
}: Props) {
  // While typing we keep the raw text (so "12." survives); when not editing we show the value.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : String(value));

  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));

  return (
    <Field label={label} hint={hint} error={error} required={required} hideLabel={hideLabel}>
      {(control) => (
        <div className="adm-affix">
          {prefix ? <span className="adm-affix-text" aria-hidden="true">{prefix}</span> : null}
          <input
            className="adm-input adm-num"
            {...control}
            type="text"
            inputMode={decimal ? "decimal" : "numeric"}
            autoComplete="off"
            disabled={disabled}
            value={shown}
            onChange={(e) => {
              const text = sanitize(e.target.value, decimal);
              setDraft(text);
              onChange(text === "" || text === "." ? null : Number(text));
            }}
            onBlur={() => {
              setDraft(null);
              if (value !== null && Number.isFinite(value)) {
                const clamped = clamp(value);
                if (clamped !== value) onChange(clamped);
              }
            }}
          />
          {suffix ? <span className="adm-affix-text" aria-hidden="true">{suffix}</span> : null}
        </div>
      )}
    </Field>
  );
}
