import type { InputHTMLAttributes } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> {
  label: string;
  hint?: string;
}

export function Checkbox({ label, hint, ...props }: Props) {
  return (
    <label className="adm-check">
      <input type="checkbox" {...props} />
      <span className="adm-check-text">
        <span>{label}</span>
        {hint ? <span className="adm-field-hint">{hint}</span> : null}
      </span>
    </label>
  );
}
