import type { SelectHTMLAttributes } from "react";
import { Field } from "./Field";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "className" | "children"> {
  label: string;
  options: (SelectOption & { disabled?: boolean })[];
  hint?: string;
  error?: string;
  hideLabel?: boolean;
}

/** Native select: keyboard, mobile pickers and screen readers work out of the box. */
export function Select({ label, options, hint, error, required, hideLabel, ...props }: Props) {
  return (
    <Field label={label} hint={hint} error={error} required={required} hideLabel={hideLabel}>
      {(control) => (
        <select className="adm-input" {...control} {...props}>
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
