"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "end";
}

interface TableProps<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  /** When given, rows turn into cards below 768px */
  renderCard?: (row: T) => ReactNode;
  empty?: ReactNode;
}

export function Table<T>({ caption, columns, rows, getKey, renderCard, empty }: TableProps<T>) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // A table that scrolls sideways must be reachable with the keyboard, otherwise keyboard users
  // cannot see the hidden columns. We only add the tab stop while it really overflows.
  const [scrollable, setScrollable] = useState(false);
  const hasRows = !(rows.length === 0 && empty);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return; // every current browser has it; jsdom does not
    const measure = () => setScrollable(el.scrollWidth > el.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const table = el.firstElementChild;
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, [hasRows]);

  if (!hasRows) return <>{empty}</>;
  return (
    <>
      <div
        ref={wrapRef}
        className="adm-table-wrap"
        data-has-cards={renderCard ? "true" : "false"}
        role={scrollable ? "region" : undefined}
        aria-label={scrollable ? caption : undefined}
        tabIndex={scrollable ? 0 : undefined}
      >
        <table className="adm-table">
          <caption className="adm-sr">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={c.align === "end" ? "is-end" : undefined}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getKey(row)}>
                {columns.map((c) => (
                  <td key={c.key} className={c.align === "end" ? "is-end" : undefined}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {renderCard ? (
        <ul className="adm-cards" aria-label={caption}>
          {rows.map((row) => (
            <li key={getKey(row)}>{renderCard(row)}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
