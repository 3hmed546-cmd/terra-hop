"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import { deriveProductStatus, openOrdersLosingVariants, uniqueSlug, type AffectedOrder } from "@/lib/admin/inventory";
import { adminHref } from "@/lib/admin/paths";
import {
  emptyForm, formToProduct, isFormEqual, productToForm, validateForm, type FormStatus, type ProductForm as FormState,
} from "@/lib/admin/product-form";
import { useAdminStore } from "@/lib/admin/store";
import { useUnsavedChanges } from "@/lib/admin/use-unsaved-changes";
import type { Product, ProductCategory } from "@/lib/admin/types";
import { PageHeader } from "../PageHeader";
import { Button, Dialog, EmptyState, NumberInput, Select, StatusBadge, Tabs, Textarea, TextInput, useToast } from "../ui";
import { ImagesField } from "./ImagesField";
import { RestockDialog } from "./RestockDialog";
import { StockLog } from "./StockLog";
import { VariantsField } from "./VariantsField";
import { LookField } from "./LookField";
import { buildProductCaptionTemplate } from "@/lib/broadcast-templates";

const F = ADMIN_STRINGS.productForm;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="adm-card adm-form-section" aria-labelledby={`sec-${id}`}>
      <h2 className="adm-h2" id={`sec-${id}`}>{title}</h2>
      {children}
    </section>
  );
}

type ProductTab = "details" | "log";

interface EditorProps {
  initial: FormState;
  existing: Product | null;
  isNew: boolean;
  tab: ProductTab;
  onTab: (tab: ProductTab) => void;
  /** Set when the Stock log title should take focus after this editor is rebuilt (after a restock). */
  focusLogRef: MutableRefObject<boolean>;
}

function Editor({ initial, existing, isNew, tab, onTab, focusLogRef }: EditorProps) {
  const router = useRouter();
  const toast = useToast();
  const { data, actions } = useAdminStore();
  const [form, setForm] = useState<FormState>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const logHeadingRef = useRef<HTMLHeadingElement>(null);
  const [restocking, setRestocking] = useState(false);
  const [focusSummary, setFocusSummary] = useState(0);
  const [pendingRemoval, setPendingRemoval] = useState<{ product: Product; status: FormStatus; affected: AffectedOrder[] } | null>(null);
  const [notifyConfirmed, setNotifyConfirmed] = useState(false);
  const [broadcastNote, setBroadcastNote] = useState("");
  const [broadcastCaption, setBroadcastCaption] = useState("");
  const [captionTouched, setCaptionTouched] = useState(false);

  const threshold = data?.settings.lowStockThreshold ?? 3;
  const takenSlugs = useMemo(
    () => (data?.products ?? []).filter((p) => p.id !== form.productId).map((p) => p.slug),
    [data, form.productId],
  );
  const errors = useMemo(() => (submitted ? validateForm(form, takenSlugs) : {}), [submitted, form, takenSlugs]);
  const errorList = Object.values(errors);

  const dirty = !isFormEqual(form, initial) && !saved;
  useUnsavedChanges(dirty, setLeaveTo);

  useEffect(() => {
    if (focusSummary > 0) summaryRef.current?.focus();
  }, [focusSummary]);

  useEffect(() => {
    if (focusLogRef.current) {
      focusLogRef.current = false;
      logHeadingRef.current?.focus();
    }
  }, [focusLogRef]);

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));
  const setDetails = (p: Partial<FormState["details"]>) => setForm((f) => ({ ...f, details: { ...f.details, ...p } }));

  const onName = (name: string) =>
    setForm((f) => ({ ...f, name, slug: f.slugTouched ? f.slug : name.trim() ? uniqueSlug(name, takenSlugs) : "" }));

  const preview = useMemo(() => deriveProductStatus(formToProduct(form, null, ""), threshold), [form, threshold]);

  const save = (intent: "draft" | "publish") => {
    const status: FormStatus = intent === "draft" ? "draft" : form.status === "draft" ? "available" : form.status;
    const next = { ...form, status };
    setForm(next);
    setSubmitted(true);
    const found = validateForm(next, takenSlugs);
    if (Object.keys(found).length > 0) {
      setFocusSummary((n) => n + 1);
      return;
    }
    const product = formToProduct(next, existing, new Date().toISOString());
    if (existing && data) {
      // Removing a colour or size that an open order still uses would make that order unsellable.
      const affected = openOrdersLosingVariants(data, product.id, product);
      if (affected.length > 0) {
        setPendingRemoval({ product, status, affected });
        return;
      }
    }
    void commitSave(product, status);
  };

  const commitSave = async (product: Product, status: FormStatus) => {
    const result = await actions.saveProduct(product, {
      notifyConfirmedCustomers: isNew ? notifyConfirmed : false,
      broadcastCustomNote: isNew && notifyConfirmed ? broadcastNote.trim() : undefined,
      broadcastCustomCaption: isNew && notifyConfirmed && broadcastCaption ? broadcastCaption.trim() : undefined,
    });
    if (!result.ok) {
      toast.push(ADMIN_STRINGS.errors[result.error]);
      return;
    }
    setSaved(true);
    if (isNew && notifyConfirmed) {
      toast.push(`تم حفظ المنتج ${product.name} وجاري إرسال إشعار الواتساب للعملاء المؤكدين! 🚀`);
    } else {
      toast.push(status === "draft" ? F.savedDraft(product.name) : F.saved(product.name));
    }
    router.push(adminHref("/products"));
  };

  const leave = useCallback(() => {
    if (!leaveTo) return;
    setSaved(true);
    const target = leaveTo;
    setLeaveTo(null);
    router.push(target);
  }, [leaveTo, router]);

  const E = F.errors;
  const err = (code?: keyof typeof E) => (code ? E[code] : undefined);
  const statusOptions: { value: FormStatus; label: string; hint: string }[] = [
    { value: "available", label: F.status.available, hint: F.status.availableHint },
    { value: "sold_out", label: F.status.sold_out, hint: F.status.sold_outHint },
    { value: "draft", label: F.status.draft, hint: F.status.draftHint },
  ];

  const formEl = (
      <form className="adm-form" noValidate onSubmit={(e) => { e.preventDefault(); save("publish"); }}>
        {errorList.length > 0 ? (
          <div ref={summaryRef} tabIndex={-1} role="alert" className="adm-summary">
            <strong>{F.summaryTitle(errorList.length)}</strong>
            <ul>
              {errorList.map((code) => (
                <li key={code}>{E[code]}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <Section id="basics" title={F.sections.basics}>
          <TextInput label={F.name} required value={form.name} maxLength={80} error={err(errors.name)} onChange={(e) => onName(e.target.value)} />
          <TextInput
            label={F.slug}
            required
            hint={F.slugHint}
            value={form.slug}
            maxLength={80}
            error={err(errors.slug)}
            onChange={(e) => patch({ slug: e.target.value, slugTouched: true })}
          />
          <Textarea label={F.description} value={form.description} maxLength={1000} onChange={(e) => patch({ description: e.target.value })} />
          <Select
            label={F.category}
            value={form.category}
            onChange={(e) => patch({ category: e.target.value as ProductCategory })}
            options={(["tshirt", "hoodie", "pants", "other"] as const).map((c) => ({ value: c, label: ADMIN_STRINGS.products.category[c] }))}
          />
        </Section>

        <Section id="price" title={F.sections.price}>
          <div className="adm-grid-2">
            <NumberInput label={F.price} required decimal prefix="EGP" min={0} max={9999999} value={form.price} error={err(errors.price)} onChange={(n) => patch({ price: n })} />
            <NumberInput label={F.compareAt} decimal prefix="EGP" min={0} max={9999999} value={form.compareAt} hint={F.compareAtHint} error={err(errors.compareAt)} onChange={(n) => patch({ compareAt: n })} />
          </div>
        </Section>

        <Section id="images" title={F.sections.images}>
          <ImagesField images={form.images} onChange={(images) => patch({ images })} />
        </Section>

        <Section id="variants" title={F.sections.variants}>
          <VariantsField form={form} onChange={setForm} errors={errors} />
        </Section>

        <Section id="status" title={F.sections.status}>
          <fieldset className="adm-fieldset">
            <legend className="adm-field-label">{F.status.legend}</legend>
            {statusOptions.map((o) => (
              <label key={o.value} className="adm-check">
                <input type="radio" name="status" value={o.value} checked={form.status === o.value} onChange={() => patch({ status: o.value })} />
                <span className="adm-check-text">
                  <span>{o.label}</span>
                  <span className="adm-field-hint">{o.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="adm-row" role="status">
            <span className="adm-label adm-muted">{F.status.current}</span>
            <StatusBadge kind={preview.kind} left={preview.total} />
          </div>
          {preview.total === 0 && form.status === "available" ? <p className="adm-muted adm-nomargin">{F.status.autoSoldOut}</p> : null}
          <NumberInput
            label={F.lowStock}
            min={0}
            max={9999}
            value={form.lowStock}
            hint={F.lowStockHint(threshold)}
            error={err(errors.lowStock)}
            onChange={(n) => patch({ lowStock: n })}
          />
        </Section>

        <Section id="details" title={F.sections.details}>
          <div className="adm-grid-2">
            <TextInput label={F.details.material} value={form.details.material} maxLength={120} onChange={(e) => setDetails({ material: e.target.value })} />
            <TextInput label={F.details.weight} value={form.details.weight} maxLength={60} onChange={(e) => setDetails({ weight: e.target.value })} />
          </div>
          <TextInput label={F.details.care} value={form.details.care} maxLength={200} onChange={(e) => setDetails({ care: e.target.value })} />
          <Textarea label={F.details.sizeChart} hint={F.details.sizeChartHint} value={form.details.sizeChart} maxLength={1000} onChange={(e) => setDetails({ sizeChart: e.target.value })} />
        </Section>

        <Section id="look" title="الإطلالة المتكاملة (Complete Look)">
          <LookField
            look={form.details.look}
            currentProductId={form.productId}
            allProducts={data?.products ?? []}
            onChange={(look) => setDetails({ look })}
          />
        </Section>

        {isNew ? (
          <Section id="broadcast" title="إشعار العملاء المؤكدين عبر الواتساب (VIP Broadcast) 💬">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={notifyConfirmed}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setNotifyConfirmed(checked);
                    if (checked && (!broadcastCaption || !captionTouched)) {
                      const initialCaption = buildProductCaptionTemplate({
                        nameAr: form.name || "قطعة جديدة من TERRA HOP",
                        priceCents: Math.round((form.price || 0) * 100),
                        compareAtCents: form.compareAt ? Math.round(form.compareAt * 100) : null,
                        colors: form.colors.map((c) => c.name).filter(Boolean),
                        sizes: form.variants.map((v) => v.size).filter(Boolean),
                        descriptionAr: form.description,
                        details: form.details,
                        slug: form.slug || "new-item",
                      });
                      setBroadcastCaption(initialCaption);
                    }
                  }}
                  style={{ width: 18, height: 18, cursor: "pointer" }}
                />
                <span>إرسال إشعار بهذه القطعة الجديدة لجميع العملاء المؤكدين في الخزنة تلقائياً 🚀</span>
              </label>
              {notifyConfirmed ? (
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ fontSize: "13px", fontWeight: 700 }}>
                      نص رسالة الواتساب بالكامل (يمكنك التعديل عليها بحرية):
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const regenerated = buildProductCaptionTemplate({
                          nameAr: form.name || "قطعة جديدة من TERRA HOP",
                          priceCents: Math.round((form.price || 0) * 100),
                          compareAtCents: form.compareAt ? Math.round(form.compareAt * 100) : null,
                          colors: form.colors.map((c) => c.name).filter(Boolean),
                          sizes: form.variants.map((v) => v.size).filter(Boolean),
                          descriptionAr: form.description,
                          details: form.details,
                          slug: form.slug || "new-item",
                        });
                        setBroadcastCaption(regenerated);
                        setCaptionTouched(false);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#0284c7",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      🔄 توليد النموذج الافتراضي ببيانات هذا المنتج
                    </button>
                  </div>
                  <Textarea
                    label="نص رسالة الواتساب بالكامل (يمكنك التعديل عليها بحرية)"
                    rows={12}
                    value={broadcastCaption}
                    onChange={(e) => {
                      setBroadcastCaption(e.target.value);
                      setCaptionTouched(true);
                    }}
                  />
                  <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
                    💡 يتم إرسال صورة المنتج مع نص الرسالة بالصيغة الراقية لجميع عملائك المسجلين بأعلى معايير الأمان.
                  </p>
                </div>
              ) : null}
            </div>
          </Section>
        ) : null}

        <div className="adm-form-actions">
          <Link className="adm-btn adm-btn-ghost" href={adminHref("/products")}>{F.actions.cancel}</Link>
          <Button variant="secondary" onClick={() => save("draft")}>{F.actions.saveDraft}</Button>
          <Button type="submit">{isNew || existing?.status === "draft" ? F.actions.publish : F.actions.saveChanges}</Button>
        </div>
      </form>
  );

  return (
    <>
      <PageHeader
        title={isNew ? F.titleNew : F.titleEdit}
        description={isNew ? F.descNew : `${form.name || existing?.name || ""} · ${F.descEdit}`}
      />

      {isNew || !existing ? (
        formEl
      ) : (
        <Tabs
          label={ADMIN_STRINGS.stockLog.tabsLabel}
          items={[
            { id: "details", label: ADMIN_STRINGS.stockLog.tabDetails },
            { id: "log", label: ADMIN_STRINGS.stockLog.tabLog },
          ]}
          value={tab}
          onChange={(id) => onTab(id as ProductTab)}
          panels={{
            details: formEl,
            log: <StockLog product={existing} dirty={dirty} onRestock={() => setRestocking(true)} headingRef={logHeadingRef} />,
          }}
        />
      )}

      <RestockDialog
        product={restocking ? existing : null}
        onClose={() => setRestocking(false)}
        onDone={() => { focusLogRef.current = true; }}
      />

      <Dialog
        open={pendingRemoval !== null}
        onClose={() => setPendingRemoval(null)}
        title={F.removeVariants.title}
        description={F.removeVariants.text}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingRemoval(null)}>{F.removeVariants.keep}</Button>
            <Button
              onClick={() => {
                if (pendingRemoval) void commitSave(pendingRemoval.product, pendingRemoval.status);
                setPendingRemoval(null);
              }}
            >
              {F.removeVariants.confirm}
            </Button>
          </>
        }
      >
        <ul className="adm-notes">
          {pendingRemoval?.affected.map((o) => (
            <li key={o.orderId}>{F.removeVariants.line(o.orderNumber, o.items.join("; "))}</li>
          ))}
        </ul>
      </Dialog>

      <Dialog
        open={leaveTo !== null}
        onClose={() => setLeaveTo(null)}
        title={F.unsaved.title}
        description={F.unsaved.text}
        footer={
          <>
            <Button variant="secondary" onClick={leave}>{F.unsaved.leave}</Button>
            <Button onClick={() => setLeaveTo(null)}>{F.unsaved.stay}</Button>
          </>
        }
      />
    </>
  );
}

export function ProductForm({ productId }: { productId?: string }) {
  const { data, ready } = useAdminStore();
  const [newId] = useState(() => `p_${Date.now().toString(36)}`);
  const [tab, setTab] = useState<ProductTab>("details");
  const focusLogRef = useRef(false);
  const header = <PageHeader title={productId ? F.titleEdit : F.titleNew} />;

  if (!ready || !data) {
    return (
      <>
        {header}
        <div className="adm-skeleton" role="status">
          <span className="adm-sr">{ADMIN_STRINGS.common.loading}</span>
        </div>
      </>
    );
  }
  if (!productId) return <Editor key={newId} initial={emptyForm(newId)} existing={null} isNew tab="details" onTab={setTab} focusLogRef={focusLogRef} />;

  const existing = data.products.find((p) => p.id === productId || p.slug === productId) ?? null;
  if (!existing) {
    return (
      <>
        {header}
        <EmptyState
          title={F.notFound.title}
          description={F.notFound.text}
          action={<Link className="adm-btn adm-btn-secondary" href={adminHref("/products")}>{F.notFound.back}</Link>}
        />
      </>
    );
  }
  // Rebuilt whenever this product changes in the store (for example after a restock), so the form
  // never keeps stale stock numbers that a later Save would write back.
  return (
    <Editor
      key={`${existing.id}:${existing.updatedAt}`}
      initial={productToForm(existing)}
      existing={existing}
      isNew={false}
      tab={tab}
      onTab={setTab}
      focusLogRef={focusLogRef}
    />
  );
}
