import { useId, type ReactNode } from "react";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";

export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Keep the label for screen readers but do not show it (for controls inside table rows). */
  hideLabel?: boolean;
  children: (control: FieldControlProps) => ReactNode;
}

/** Label + control + hint + error, wired together with ids so screen readers read all of it. */
export function Field({ label, hint, error, required, hideLabel, children }: FieldProps) {
  const uid = useId();
  const id = `${uid}-control`;
  const hintId = hint ? `${uid}-hint` : undefined;
  const errorId = error ? `${uid}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="adm-field">
      <label className={hideLabel ? "adm-sr" : "adm-field-label"} htmlFor={id}>
        {label}
        {required ? <span className="adm-sr"> ({ADMIN_STRINGS.common.required})</span> : null}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required ? true : undefined,
      })}
      {hint ? (
        <span id={hintId} className="adm-field-hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="adm-field-error">
          {ADMIN_STRINGS.common.errorPrefix} {error}
        </span>
      ) : null}
    </div>
  );
}
