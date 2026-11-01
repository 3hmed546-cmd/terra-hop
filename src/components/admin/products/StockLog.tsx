"use client";
import Link from "next/link";
import { useMemo, useState, type RefObject } from "react";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import { formatDateTime } from "@/lib/admin/format";
import { adminHref } from "@/lib/admin/paths";
import { useAdminStore } from "@/lib/admin/store";
import { formatDelta, stockLogForProduct, stockLogVariantOptions, type StockLogRow } from "@/lib/admin/stock-log";
import type { Product } from "@/lib/admin/types";
import { Button, EmptyState, Select, Table, type Column } from "../ui";

const S = ADMIN_STRINGS.stockLog;

function Reference({ row }: { row: StockLogRow }) {
  return (
    <div>
      {row.orderId && row.orderNumber ? (
        <Link className="adm-plink adm-num" href={adminHref(`/orders/${row.orderId}`)}>
          {row.orderNumber}
        </Link>
      ) : null}
      {row.note ? <div className="adm-muted adm-small">{row.note}</div> : null}
      {!row.orderNumber && !row.note ? <span className="adm-muted">—</span> : null}
    </div>
  );
}

const variantText = (row: StockLogRow): string => row.variantLabel ?? S.removedVariant;

interface Props {
  product: Product;
  /** Unsaved changes in the Details form: adding stock is paused so they cannot overwrite it. */
  dirty: boolean;
  onRestock: () => void;
  /** The panel title takes focus after a restock (the form behind it is rebuilt). */
  headingRef: RefObject<HTMLHeadingElement | null>;
}

export function StockLog({ product, dirty, onRestock, headingRef }: Props) {
  const { data } = useAdminStore();
  const [variant, setVariant] = useState("all");

  const all = useMemo(() => (data ? stockLogForProduct(data, product.id) : []), [data, product.id]);
  const rows = useMemo(() => (data ? stockLogForProduct(data, product.id, variant) : []), [data, product.id, variant]);
  const options = useMemo(() => [{ value: "all", label: S.filterAll }, ...stockLogVariantOptions(product)], [product]);

  const columns: Column<StockLogRow>[] = [
    { key: "when", header: S.columns.when, cell: (r) => <span className="adm-num">{formatDateTime(r.at)}</span> },
    { key: "variant", header: S.columns.variant, cell: (r) => variantText(r) },
    { key: "change", header: S.columns.change, align: "end", cell: (r) => <strong className="adm-num">{formatDelta(r.delta)}</strong> },
    { key: "level", header: S.columns.level, align: "end", cell: (r) => <span className="adm-num">{S.level(r.before, r.after)}</span> },
    { key: "reason", header: S.columns.reason, cell: (r) => S.reasons[r.reason] },
    { key: "reference", header: S.columns.reference, cell: (r) => <Reference row={r} /> },
  ];

  const emptyState =
    all.length === 0 ? (
      <EmptyState title={S.empty.title} description={S.empty.text} />
    ) : (
      <EmptyState title={S.noMatch.title} description={S.noMatch.text} action={<Button variant="secondary" onClick={() => setVariant("all")}>{S.filterAll}</Button>} />
    );

  return (
    <section className="adm-stack" aria-labelledby="stock-log-title">
      <div className="adm-page-head adm-subhead">
        <div>
          <h2 id="stock-log-title" ref={headingRef} tabIndex={-1} className="adm-h2">{S.title}</h2>
          <p className="adm-muted adm-nomargin">{S.intro}</p>
        </div>
        <div className="adm-page-actions">
          <Button variant="secondary" aria-disabled={dirty ? true : undefined} aria-describedby={dirty ? "restock-blocked" : undefined} onClick={() => { if (!dirty) onRestock(); }}>
            {S.restock}
          </Button>
        </div>
      </div>
      {dirty ? <p id="restock-blocked" className="adm-warn">{S.restockBlocked}</p> : null}

      {all.length > 0 ? (
        <>
          <div className="adm-toolbar adm-toolbar-single">
            <Select label={S.filterLabel} options={options} value={variant} onChange={(e) => setVariant(e.target.value)} />
          </div>
          <p className="adm-results" role="status">{S.count(rows.length, all.length)}</p>
        </>
      ) : null}

      <Table
        caption={S.caption(product.name)}
        rows={rows}
        getKey={(r) => r.id}
        columns={columns}
        empty={emptyState}
        renderCard={(r) => (
          <div className="adm-pcard">
            <div>
              <div>{variantText(r)}</div>
              <div className="adm-muted adm-small adm-num">{formatDateTime(r.at)}</div>
            </div>
            <dl className="adm-pcard-facts">
              <div>
                <dt className="adm-label adm-muted">{S.columns.change}</dt>
                <dd className="adm-num"><strong>{formatDelta(r.delta)}</strong></dd>
              </div>
              <div>
                <dt className="adm-label adm-muted">{S.columns.level}</dt>
                <dd className="adm-num">{S.level(r.before, r.after)}</dd>
              </div>
              <div>
                <dt className="adm-label adm-muted">{S.columns.reason}</dt>
                <dd>{S.reasons[r.reason]}</dd>
              </div>
            </dl>
            <Reference row={r} />
          </div>
        )}
      />
    </section>
  );
}
