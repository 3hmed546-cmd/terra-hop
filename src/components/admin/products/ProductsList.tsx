"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import { formatDate, formatMoney, formatNumber } from "@/lib/admin/format";
import {
  canMakeAvailable,
  deriveProductStatus,
  openOrdersForProduct,
  productTotalStock,
  quickStatusOf,
  type QuickStatus,
} from "@/lib/admin/inventory";
import { adminHref } from "@/lib/admin/paths";
import {
  countByStatus,
  DEFAULT_QUERY,
  isDefaultQuery,
  queryProducts,
  SORT_KEYS,
  STATUS_FILTERS,
  type ListQuery,
  type SortKey,
  type StatusFilter,
} from "@/lib/admin/product-list";
import { useAdminStore } from "@/lib/admin/store";
import type { Product } from "@/lib/admin/types";
import { PageHeader } from "../PageHeader";
import { Button, Dialog, EmptyState, Select, StatusBadge, Table, Tabs, TextInput, useToast, type Column } from "../ui";

const S = ADMIN_STRINGS.products;

function Thumb({ product }: { product: Product }) {
  const url = product.images[0]?.url;
  return (
    <span
      className="adm-thumb"
      aria-hidden="true"
      style={url ? { backgroundImage: `url(${JSON.stringify(url)})` } : undefined}
    >
      {url ? null : product.name.charAt(0).toUpperCase()}
    </span>
  );
}

function ProductName({ product }: { product: Product }) {
  return (
    <div className="adm-pname">
      <Thumb product={product} />
      <div>
        <Link className="adm-plink" href={adminHref(`/products/${product.id}`)}>
          {product.name}
        </Link>
        <div className="adm-muted adm-small">
          {S.category[product.category]} · {S.updated(formatDate(product.updatedAt))}
        </div>
      </div>
    </div>
  );
}

function Price({ product }: { product: Product }) {
  return (
    <div className="adm-num">
      {formatMoney(product.priceCents)}
      {product.compareAtCents ? (
        <div className="adm-muted adm-small">
          <s>{formatMoney(product.compareAtCents)}</s>
          <span className="adm-sr"> {S.wasPrice(formatMoney(product.compareAtCents))}</span>
        </div>
      ) : null}
    </div>
  );
}

function Status({ product, threshold }: { product: Product; threshold: number }) {
  const { kind, total } = deriveProductStatus(product, threshold);
  return (
    <div className="adm-stack-sm">
      <StatusBadge kind={kind} left={total} />
      {product.forceSoldOut && product.status === "active" && total > 0 ? (
        <span className="adm-muted adm-small">{S.manualSoldOut}</span>
      ) : null}
    </div>
  );
}

function RowActions({
  product,
  threshold,
  onDelete,
}: {
  product: Product;
  threshold: number;
  onDelete: (p: Product) => void;
}) {
  const { actions } = useAdminStore();
  const toast = useToast();
  const SC = S.statusChange;
  const labels: Record<QuickStatus, string> = { available: SC.available, sold_out: SC.soldOut, draft: SC.draft };

  const change = (target: QuickStatus) => {
    const result = actions.setProductStatus(product.id, target);
    toast.push(result.ok ? SC.changed(product.name, labels[target]) : ADMIN_STRINGS.errors[result.error]);
  };

  const duplicate = () => {
    const result = actions.duplicateProduct(product.id, `p_${Date.now().toString(36)}`);
    toast.push(result.ok ? S.duplicated(product.name) : ADMIN_STRINGS.errors[result.error]);
  };

  return (
    <div className="adm-row-actions">
      <Select
        label={SC.label(product.name)}
        hideLabel
        value={quickStatusOf(product, threshold)}
        onChange={(e) => change(e.target.value as QuickStatus)}
        options={[
          { value: "available", label: canMakeAvailable(product) ? SC.available : SC.availableNoStock, disabled: !canMakeAvailable(product) },
          { value: "sold_out", label: SC.soldOut },
          { value: "draft", label: SC.draft },
        ]}
      />
      <div className="adm-row-links">
        <Link className="adm-btn adm-btn-ghost" href={adminHref(`/products/${product.id}`)} aria-label={S.editAria(product.name)}>
          {S.edit}
        </Link>
        <Button variant="ghost" onClick={duplicate} aria-label={S.duplicateAria(product.name)}>
          {S.duplicate}
        </Button>
        <Button variant="ghost" onClick={() => onDelete(product)} aria-label={S.deleteAria(product.name)}>
          {S.delete}
        </Button>
      </div>
    </div>
  );
}

export function ProductsList() {
  const { data, ready, actions } = useAdminStore();
  const toast = useToast();
  const [query, setQuery] = useState<ListQuery>(DEFAULT_QUERY);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const resultsRef = useRef<HTMLParagraphElement>(null);
  const refocus = useRef(false);

  // After the delete dialog has closed, the row that opened it is gone: put focus on the results line.
  useEffect(() => {
    if (deleting === null && refocus.current) {
      refocus.current = false;
      resultsRef.current?.focus();
    }
  }, [deleting]);

  const threshold = data?.settings.lowStockThreshold ?? 3;
  const products = data?.products;
  const visible = useMemo(() => (products ? queryProducts(products, query, threshold) : []), [products, query, threshold]);
  const counts = useMemo(() => (products ? countByStatus(products, threshold) : null), [products, threshold]);

  const header = (
    <PageHeader
      title={ADMIN_STRINGS.pages.products.title}
      description={ADMIN_STRINGS.pages.products.summary}
      actions={
        <Link className="adm-btn adm-btn-primary" href={adminHref("/products/new")}>
          {S.addProduct}
        </Link>
      }
    />
  );

  if (!ready || !data || !counts) {
    return (
      <>
        {header}
        <div className="adm-skeleton" role="status">
          <span className="adm-sr">{ADMIN_STRINGS.common.loading}</span>
        </div>
      </>
    );
  }

  if (data.products.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          title={S.empty.title}
          description={S.empty.description}
          action={
            <Link className="adm-btn adm-btn-primary" href={adminHref("/products/new")}>
              {S.empty.action}
            </Link>
          }
        />
      </>
    );
  }

  const openOrders = deleting ? openOrdersForProduct(data, deleting.id).length : 0;

  const confirmDelete = () => {
    if (!deleting) return;
    const result = actions.deleteProduct(deleting.id);
    toast.push(result.ok ? S.deleteDialog.deleted(deleting.name) : ADMIN_STRINGS.errors[result.error]);
    refocus.current = result.ok;
    setDeleting(null);
  };

  const columns: Column<Product>[] = [
    { key: "product", header: S.columns.product, cell: (p) => <ProductName product={p} /> },
    { key: "price", header: S.columns.price, cell: (p) => <Price product={p} /> },
    { key: "stock", header: S.columns.stock, cell: (p) => <span className="adm-num">{formatNumber(productTotalStock(p))}</span> },
    { key: "status", header: S.columns.status, cell: (p) => <Status product={p} threshold={threshold} /> },
    { key: "actions", header: S.columns.actions, cell: (p) => <RowActions product={p} threshold={threshold} onDelete={setDeleting} /> },
  ];

  const renderCard = (p: Product) => (
    <div className="adm-pcard">
      <ProductName product={p} />
      <dl className="adm-pcard-facts">
        <div>
          <dt className="adm-label adm-muted">{S.columns.price}</dt>
          <dd><Price product={p} /></dd>
        </div>
        <div>
          <dt className="adm-label adm-muted">{S.stockLabel}</dt>
          <dd className="adm-num">{formatNumber(productTotalStock(p))}</dd>
        </div>
      </dl>
      <Status product={p} threshold={threshold} />
      <RowActions product={p} threshold={threshold} onDelete={setDeleting} />
    </div>
  );

  const clear = () => setQuery((q) => ({ ...q, search: "", status: "all" }));

  return (
    <>
      {header}

      <div className="adm-toolbar">
        <TextInput
          label={S.searchLabel}
          type="search"
          placeholder={S.searchPlaceholder}
          value={query.search}
          autoComplete="off"
          onChange={(e) => setQuery((q) => ({ ...q, search: e.target.value }))}
        />
        <Select
          label={S.sortLabel}
          value={query.sort}
          onChange={(e) => setQuery((q) => ({ ...q, sort: e.target.value as SortKey }))}
          options={SORT_KEYS.map((k) => ({ value: k, label: S.sorts[k] }))}
        />
      </div>

      <Tabs
        label={S.statusTabsLabel}
        value={query.status}
        onChange={(id) => setQuery((q) => ({ ...q, status: id as StatusFilter }))}
        items={STATUS_FILTERS.map((id) => ({ id, label: S.filters[id], count: counts[id] }))}
      >
        <p ref={resultsRef} tabIndex={-1} role="status" className="adm-results adm-muted">
          {S.results(visible.length, data.products.length)}
        </p>
        <Table
          caption={S.tableCaption}
          columns={columns}
          rows={visible}
          getKey={(p) => p.id}
          renderCard={renderCard}
          empty={
            <EmptyState
              title={S.noMatch.title}
              description={S.noMatch.description}
              action={
                isDefaultQuery(query) ? undefined : (
                  <Button variant="secondary" onClick={clear}>
                    {S.noMatch.action}
                  </Button>
                )
              }
            />
          }
        />
      </Tabs>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={deleting ? S.deleteDialog.title(deleting.name) : ""}
        description={S.deleteDialog.text}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {ADMIN_STRINGS.common.cancel}
            </Button>
            <Button onClick={confirmDelete}>{S.deleteDialog.confirm}</Button>
          </>
        }
      >
        {openOrders > 0 ? <p className="adm-warn" role="alert">{S.deleteDialog.openOrders(openOrders)}</p> : null}
      </Dialog>
    </>
  );
}
