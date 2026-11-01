import type { TextareaHTMLAttributes } from "react";
import { Field } from "./Field";

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className"> {
  label: string;
  hint?: string;
  error?: string;
}

export function Textarea({ label, hint, error, required, ...props }: Props) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(control) => <textarea className="adm-input" {...control} {...props} />}
    </Field>
  );
}
