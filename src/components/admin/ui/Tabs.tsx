"use client";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  children?: ReactNode;
  /**
   * Optional: one panel per tab id, ALL kept mounted (the inactive ones are hidden), so a form in one
   * tab keeps what was typed while another tab is shown. When given, `children` is not used.
   */
  panels?: Record<string, ReactNode>;
}

/** Tab list + panel (WAI-ARIA tabs pattern: arrow keys, Home and End move between tabs). */
export function Tabs({ items, value, onChange, label, children, panels }: TabsProps) {
  const uid = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (index: number) => {
    const next = (index + items.length) % items.length;
    onChange(items[next].id);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    if (e.key === "ArrowRight") move(index + 1);
    else if (e.key === "ArrowLeft") move(index - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(items.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div>
      <div className="adm-tabs" role="tablist" aria-label={label}>
        {items.map((item, i) => (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${uid}-tab-${item.id}`}
            aria-selected={item.id === value}
            aria-controls={panels ? `${uid}-panel-${item.id}` : `${uid}-panel`}
            tabIndex={item.id === value ? 0 : -1}
            className="adm-tab"
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {item.label}
            {item.count !== undefined ? <span className="adm-tab-count">{item.count}</span> : null}
          </button>
        ))}
      </div>
      {panels ? (
        items.map((item) => (
          <div
            key={item.id}
            role="tabpanel"
            id={`${uid}-panel-${item.id}`}
            aria-labelledby={`${uid}-tab-${item.id}`}
            hidden={item.id !== value}
          >
            {panels[item.id]}
          </div>
        ))
      ) : (
        <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${value}`} tabIndex={0}>
          {children}
        </div>
      )}
    </div>
  );
}
