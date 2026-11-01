"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import { formatMoney, formatNumber } from "@/lib/admin/format";
import { adminHref } from "@/lib/admin/paths";
import {
  changeColor,
  changeProduct,
  initialSaleForm,
  saleAvailability,
  saleTotalCents,
  sellableProducts,
  toSaleInput,
  validateSale,
  variantOfForm,
  type SaleErrorCode,
  type SaleField,
  type SaleForm,
} from "@/lib/admin/sale-form";
import { useAdminStore } from "@/lib/admin/store";
import { PageHeader } from "../PageHeader";
import {
  Button,
  EmptyState,
  NumberInput,
  Select,
  Textarea,
  TextInput,
  useToast,
} from "../ui";

const S = ADMIN_STRINGS.sale;
const HEADER = {
  title: ADMIN_STRINGS.pages.salesNew.title,
  description: S.intro,
};

export function RecordSaleForm() {
  const { data, ready, actions } = useAdminStore();
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<SaleForm | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [focusSummary, setFocusSummary] = useState(0);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusSummary > 0) summaryRef.current?.focus();
  }, [focusSummary]);

  const form = useMemo(
    () => (data ? (draft ?? initialSaleForm(data)) : null),
    [data, draft],
  );
  const errors = useMemo(
    () => (data && form && submitted ? validateSale(data, form) : {}),
    [data, form, submitted],
  );

  if (!ready || !data || !form) {
    return (
      <>
        <PageHeader {...HEADER} />
        <div className="adm-skeleton" role="status">
          <span className="adm-sr">{ADMIN_STRINGS.common.loading}</span>
        </div>
      </>
    );
  }

  const products = sellableProducts(data);
  if (products.length === 0) {
    return (
      <>
        <PageHeader {...HEADER} />
        <EmptyState
          title={S.empty.title}
          description={S.empty.text}
          action={
            <Link
              className="adm-btn adm-btn-secondary"
              href={adminHref("/products")}
            >
              {S.empty.action}
            </Link>
          }
        />
      </>
    );
  }

  const product = data.products.find((p) => p.id === form.productId);
  const variant = variantOfForm(data, form);
  const availability = saleAvailability(data, form);
  const update = (patch: Partial<SaleForm>) => setDraft({ ...form, ...patch });

  const cellStock = (colorId: string, size: string) =>
    product?.variants.find((v) => v.colorId === colorId && v.size === size)
      ?.stock ?? 0;
  const colorHasStock = (colorId: string) =>
    product?.variants.some((v) => v.colorId === colorId && v.stock > 0) ??
    false;

  const message = (code: SaleErrorCode | undefined): string | undefined => {
    if (!code) return undefined;
    return code === "qtyTooMany"
      ? S.errors.qtyTooMany(variant?.stock ?? 0)
      : S.errors[code];
  };
  const err = (field: SaleField) => message(errors[field]);
  const errorList = (Object.keys(errors) as SaleField[]).map((f) =>
    message(errors[f])!,
  );

  const submit = () => {
    setSubmitted(true);
    const found = validateSale(data, form);
    if (Object.keys(found).length > 0 || !variant) {
      setFocusSummary((n) => n + 1);
      return;
    }
    const result = actions.recordSale(toSaleInput(form, variant.id));
    if (!result.ok) {
      toast.push(ADMIN_STRINGS.errors[result.error]);
      return;
    }
    const number = result.orderNumber;
    toast.push(S.done(number));
    router.push(adminHref(`/orders/${result.orderId}`));
  };

  return (
    <>
      <PageHeader {...HEADER} />

      <form
        className="adm-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {errorList.length > 0 ? (
          <div
            ref={summaryRef}
            tabIndex={-1}
            role="alert"
            className="adm-summary"
          >
            <strong>{S.summaryTitle(errorList.length)}</strong>
            <ul>
              {errorList.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <section
          className="adm-card adm-form-section"
          aria-labelledby="sale-what"
        >
          <h2 id="sale-what" className="adm-h2">
            {ADMIN_STRINGS.pages.salesNew.title}
          </h2>
          <Select
            label={S.product}
            required
            value={form.productId}
            error={err("product")}
            onChange={(e) =>
              setDraft(changeProduct(data, form, e.target.value))
            }
            options={products.map((p) => ({
              value: p.id,
              label: p.name + (p.status === "draft" ? S.draftSuffix : ""),
            }))}
          />
          <div className="adm-grid-2">
            <Select
              label={S.color}
              required
              value={form.colorId}
              error={err("color")}
              onChange={(e) =>
                setDraft(changeColor(data, form, e.target.value))
              }
              options={(product?.colors ?? []).map((c) => ({
                value: c.id,
                label: c.name + (colorHasStock(c.id) ? "" : S.noStockSuffix),
                disabled: !colorHasStock(c.id),
              }))}
            />
            <Select
              label={S.size}
              required
              value={form.size}
              error={err("size")}
              onChange={(e) => update({ size: e.target.value })}
              options={(product?.sizes ?? []).map((s) => {
                const none = cellStock(form.colorId, s) === 0;
                return {
                  value: s,
                  label: s + (none ? S.noStockSuffix : ""),
                  disabled: none,
                };
              })}
            />
          </div>
          <div className="adm-grid-2">
            <NumberInput
              label={S.qty}
              required
              min={1}
              max={9999}
              value={form.qty}
              error={err("qty")}
              onChange={(n) => update({ qty: n })}
            />
            <NumberInput
              label={S.price}
              required
              decimal
              prefix="EGP"
              min={0}
              max={9999999}
              value={form.price}
              hint={
                product
                  ? S.priceHint(formatMoney(product.priceCents))
                  : undefined
              }
              error={err("price")}
              onChange={(n) => update({ price: n })}
            />
          </div>
          <div className="adm-grid-2">
            <TextInput
              label={S.buyer}
              hint={S.buyerHint}
              value={form.buyer}
              maxLength={80}
              onChange={(e) => update({ buyer: e.target.value })}
            />
            <Textarea
              label={S.note}
              hint={S.noteHint}
              value={form.note}
              maxLength={300}
              rows={2}
              onChange={(e) => update({ note: e.target.value })}
            />
          </div>
        </section>

        <section className="adm-card" aria-labelledby="sale-summary">
          <h2 id="sale-summary" className="adm-h2">
            {S.summary.title}
          </h2>
          <div role="status">
            <dl className="adm-totals">
              <div>
                <dt>{S.summary.inStock}</dt>
                <dd className="adm-num">
                  {formatNumber(availability?.inStock ?? 0)}
                </dd>
              </div>
              <div>
                <dt>{S.summary.after}</dt>
                <dd className="adm-num">
                  {availability && availability.afterSale >= 0
                    ? formatNumber(availability.afterSale)
                    : "—"}
                </dd>
              </div>
              <div className="is-total">
                <dt>{S.summary.total}</dt>
                <dd className="adm-num">{formatMoney(saleTotalCents(form))}</dd>
              </div>
            </dl>
          </div>
          {availability?.usesHeld ? (
            <p className="adm-warn" role="alert">
              {S.heldWarning(availability.held)}
            </p>
          ) : null}
        </section>

        <div className="adm-form-actions">
          <Link
            className="adm-btn adm-btn-ghost"
            href={adminHref("/dashboard")}
          >
            {ADMIN_STRINGS.common.cancel}
          </Link>
          <Button type="submit">{S.submit}</Button>
        </div>
      </form>
    </>
  );
}
