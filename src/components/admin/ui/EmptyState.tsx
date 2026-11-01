import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="adm-empty">
      <h2 className="adm-h2">{title}</h2>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}
