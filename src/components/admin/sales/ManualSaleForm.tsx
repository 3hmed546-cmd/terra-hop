"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/admin/ui/Button";
import { Select } from "@/components/admin/ui/Select";
import { TextInput } from "@/components/admin/ui/TextInput";
import { NumberInput } from "@/components/admin/ui/NumberInput";
import { useToast } from "@/components/admin/ui/Toast";
import { formatMoney } from "@/lib/admin/format";
import { adminHref } from "@/lib/admin/paths";
import { useAdminStore } from "@/lib/admin/store";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";

export function ManualSaleForm() {
  const router = useRouter();
  const { data, ready, actions } = useAdminStore();
  const toast = useToast();

  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [unitPriceEgp, setUnitPriceEgp] = useState<number>(0);
  const [buyerName, setBuyerName] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Filter products that have at least one variant with stock > 0
  const products = useMemo(() => {
    if (!data?.products) return [];
    return data.products.filter((p) => p.status !== "draft");
  }, [data]);

  const activeProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) ?? null;
  }, [products, selectedProductId]);

  const variants = useMemo(() => {
    return activeProduct?.variants ?? [];
  }, [activeProduct]);

  const activeVariant = useMemo(() => {
    return variants.find((v) => v.id === selectedVariantId) ?? null;
  }, [variants, selectedVariantId]);

  // When product changes, auto-select first variant with stock and set price
  function handleProductChange(productId: string) {
    setSelectedProductId(productId);
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      const firstInStock = prod.variants.find((v) => v.stock > 0) ?? prod.variants[0];
      setSelectedVariantId(firstInStock ? firstInStock.id : "");
      setUnitPriceEgp(prod.priceCents / 100);
      setQty(1);
    } else {
      setSelectedVariantId("");
      setUnitPriceEgp(0);
      setQty(1);
    }
  }

  // Stock calculations
  const availableStock = activeVariant?.stock ?? 0;
  const remainingStock = availableStock - qty;
  const isOutOfStock = availableStock <= 0;
  const isQtyInvalid = qty < 1 || qty > availableStock;
  const totalCents = Math.round(unitPriceEgp * 100) * qty;

  const canSubmit =
    Boolean(activeProduct) &&
    Boolean(activeVariant) &&
    availableStock > 0 &&
    !isQtyInvalid &&
    unitPriceEgp >= 0 &&
    !submitting;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !activeVariant) return;

    setSubmitting(true);
    const res = actions.recordSale({
      variantId: activeVariant.id,
      qty,
      unitPriceCents: Math.round(unitPriceEgp * 100),
      buyerName: buyerName.trim() || undefined,
      note: note.trim() || undefined,
    });

    if (res.ok) {
      toast.push(`تم تسجيل البيع وخصم ${qty} قطعة من المخزون بنجاح!`);
      router.push(adminHref("/orders"));
    } else {
      toast.push(`تعذر تسجيل البيع: ${ADMIN_STRINGS.errors[res.error] || res.error}`);
      setSubmitting(false);
    }
  }

  if (!ready || !data) {
    return (
      <div className="adm-skeleton" role="status">
        <span className="adm-sr">{ADMIN_STRINGS.common.loading}</span>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <Link
          href={adminHref("/orders")}
          className="text-xs font-semibold text-graphite hover:text-obsidian underline underline-offset-4"
        >
          ← العودة للطلبات
        </Link>
      </div>

      <PageHeader
        title={ADMIN_STRINGS.pages.salesNew.title}
        description={ADMIN_STRINGS.pages.salesNew.summary}
      />

      <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-6">
        <div className="rounded border border-line-light bg-off-white p-6 space-y-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-charcoal">
            اختيار المنتج واللون والمقاس
          </h2>

          {/* Product Selector */}
          <Select
            label="المنتج"
            value={selectedProductId}
            onChange={(e) => handleProductChange(e.target.value)}
            options={[
              { value: "", label: "— اختر المنتج المراد بيعه —" },
              ...products.map((p) => ({
                value: p.id,
                label: `${p.name} (${formatMoney(p.priceCents)})`,
              })),
            ]}
          />

          {/* Variant Selector */}
          {activeProduct && (
            <Select
              label="اللون والمقاس"
              value={selectedVariantId}
              onChange={(e) => setSelectedVariantId(e.target.value)}
              options={variants.map((v) => {
                const color = activeProduct.colors.find((c) => c.id === v.colorId)?.name ?? "أساسي";
                return {
                  value: v.id,
                  label: `${color} · مقاس ${v.size} (المخزون: ${v.stock} قطعة)`,
                };
              })}
            />
          )}

          {/* Live Inventory Status Pill */}
          {activeVariant && (
            <div className="rounded border border-line-light bg-line-light/30 p-4 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-graphite font-medium">المخزون المتوفر بالمستودع:</span>
                <span className="font-mono font-bold text-obsidian text-sm">
                  {availableStock} قطعة
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-line-light pt-2">
                <span className="text-graphite font-medium">المتبقي بعد هذا البيع:</span>
                <span
                  className={`font-mono font-bold text-sm ${
                    remainingStock < 0 ? "text-red-600" : "text-obsidian"
                  }`}
                >
                  {remainingStock} قطعة
                </span>
              </div>
              {isOutOfStock && (
                <p className="text-red-600 font-semibold pt-1">
                  ⚠️ هذا المقاس نفد مخزونه بالكامل. لا يمكن تسجيل بيع له.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Quantity & Pricing */}
        {activeVariant && !isOutOfStock && (
          <div className="rounded border border-line-light bg-off-white p-6 space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-charcoal">
              تفاصيل البيع والتسعير
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberInput
                label="الكمية المباعة"
                value={qty}
                min={1}
                max={availableStock}
                onChange={(n) => setQty(n ?? 1)}
                error={
                  qty < 1
                    ? "الكمية يجب أن تكون 1 على الأقل"
                    : qty > availableStock
                    ? `لا يمكن تجاوز المخزون المتوفر (${availableStock})`
                    : undefined
                }
              />

              <NumberInput
                label="سعر القطعة (جنيه مصري)"
                value={unitPriceEgp}
                min={0}
                decimal
                prefix="EGP"
                onChange={(n) => setUnitPriceEgp(n ?? 0)}
                hint="السعر الافتراضي من الكتالوج. يمكنك تعديله إذا كان هناك خصم خاص."
              />
            </div>

            <TextInput
              label="اسم المشتري (اختياري)"
              placeholder="مثال: أحمد، عميل المعرض، كريم..."
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
            />

            <TextInput
              label="ملاحظات / قناة البيع (اختياري)"
              placeholder="مثال: بيع مباشر في المعرض، رسالة إنستجرام، دفع كاش عند الاستلام..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            {/* Total Sale Summary */}
            <div className="rounded border border-line-light bg-line-light/40 p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-graphite block">إجمالي قيمة البيع:</span>
                <span className="text-xs text-charcoal">
                  {qty} قطعة × {formatMoney(Math.round(unitPriceEgp * 100))}
                </span>
              </div>
              <span className="text-xl font-bold font-mono text-obsidian">
                {formatMoney(totalCents)}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={adminHref("/orders")}
            className="adm-btn adm-btn-secondary"
          >
            إلغاء
          </Link>
          <Button
            type="submit"
            disabled={!canSubmit}
            className="bg-obsidian text-off-white hover:bg-charcoal px-6 py-2.5 font-bold cursor-pointer"
          >
            {submitting ? "جاري التسجيل…" : "تأكيد وتسجيل البيع وخصم المخزون"}
          </Button>
        </div>
      </form>
    </>
  );
}
