import type { InputHTMLAttributes } from "react";
import { Field } from "./Field";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> {
  label: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
}

export function TextInput({ label, hint, error, required, hideLabel, ...props }: Props) {
  return (
    <Field label={label} hint={hint} error={error} required={required} hideLabel={hideLabel}>
      {(control) => <input className="adm-input" {...control} {...props} />}
    </Field>
  );
}
