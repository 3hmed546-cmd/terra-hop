import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="adm-page-head">
      <div>
        <h1 className="adm-h1">{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="adm-page-actions">{actions}</div> : null}
    </div>
  );
}
