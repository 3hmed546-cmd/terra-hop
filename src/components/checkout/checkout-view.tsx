"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, Truck, Mail, Phone, MapPin, ArrowRight, ArrowLeft } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale-context";
import { images } from "@/content/images";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/content/home";
import type { Order } from "@/lib/admin/types";

const EGYPT_GOVERNORATES = [
  { ar: "القاهرة", en: "Cairo" },
  { ar: "الجيزة", en: "Giza" },
  { ar: "الإسكندرية", en: "Alexandria" },
  { ar: "القليوبية", en: "Qalyubia" },
  { ar: "الشرقية", en: "Sharqia" },
  { ar: "الدقهلية", en: "Dakahlia" },
  { ar: "الغربية", en: "Gharbia" },
  { ar: "المنوفية", en: "Monufia" },
  { ar: "البحيرة", en: "Beheira" },
  { ar: "كفر الشيخ", en: "Kafr El Sheikh" },
  { ar: "دمياط", en: "Damietta" },
  { ar: "بورسعيد", en: "Port Said" },
  { ar: "الإسماعيلية", en: "Ismailia" },
  { ar: "السويس", en: "Suez" },
  { ar: "البحر الأحمر", en: "Red Sea" },
  { ar: "الفيوم", en: "Fayoum" },
  { ar: "بني سويف", en: "Beni Suef" },
  { ar: "المنيا", en: "Minya" },
  { ar: "أسيوط", en: "Asyut" },
  { ar: "سوهاج", en: "Sohag" },
  { ar: "قنا", en: "Qena" },
  { ar: "الأقصر", en: "Luxor" },
  { ar: "أسوان", en: "Aswan" },
];

export function CheckoutView({ products }: { products: Product[] }) {
  const { lines, clear } = useCart();
  const { locale, t, dir } = useLocale();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState(EGYPT_GOVERNORATES[0][locale === "ar" ? "ar" : "en"]);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  // Promo / Discount code state (securely validated server-side against .env)
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discountPercent: number } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoMessage, setPromoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleApplyPromo() {
    const clean = promoCodeInput.trim().toUpperCase();
    if (!clean) return;
    setPromoLoading(true);
    setPromoMessage(null);
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: clean }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setAppliedPromo({ code: data.code, discountPercent: data.discountPercent });
        setPromoMessage({ type: "success", text: data.message || `تم تطبيق خصم ${data.discountPercent}%!` });
      } else {
        setPromoMessage({ type: "error", text: data.error || "كود الخصم غير صحيح أو منتهي الصلاحية" });
      }
    } catch {
      setPromoMessage({ type: "error", text: "تعذر التحقق من كود الخصم حالياً" });
    } finally {
      setPromoLoading(false);
    }
  }

  function handleRemovePromo() {
    setAppliedPromo(null);
    setPromoCodeInput("");
    setPromoMessage(null);
  }

  // Cart products
  const rows = lines.flatMap((l) => {
    const product = products.find((p) => p.slug === l.slug);
    return product ? [{ ...l, product }] : [];
  });

  const subtotal = rows.reduce((sum, r) => sum + r.product.price * r.qty, 0);
  const shippingFee = 50; // Standard shipping (flat 50 EGP)
  // Free shipping offer if 2 items or more
  const totalItemCount = rows.reduce((sum, r) => sum + r.qty, 0);
  const isFreeShipping = totalItemCount >= 2;
  const finalShipping = isFreeShipping ? 0 : shippingFee;
  const discountAmount = appliedPromo ? Math.round((subtotal * appliedPromo.discountPercent) / 100) : 0;
  const grandTotal = Math.max(0, subtotal - discountAmount) + finalShipping;

  if (placedOrder) {
    return (
      <div className="mx-auto max-w-2xl py-12 px-4 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
          <CheckCircle2 className="h-10 w-10" />
        </div>

        <span className="inline-block rounded-full bg-line-light px-3 py-1 text-xs font-semibold tracking-wider uppercase text-charcoal">
          {t.checkout.success.badge}
        </span>

        <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold text-obsidian">
          {t.checkout.success.title}
        </h1>

        <div className="mt-4 rounded border border-line-light bg-off-white p-4">
          <span className="text-xs text-graphite block">{t.checkout.success.orderNumberPrefix}</span>
          <span className="font-mono text-2xl font-bold tracking-widest text-obsidian">
            {placedOrder.number}
          </span>
        </div>

        <p className="mt-4 text-sm text-graphite leading-relaxed">
          {t.checkout.success.message}
        </p>

        {/* Invoice & Email Notice Banner */}
        <div className="mt-6 rounded border border-emerald-200 bg-emerald-50/70 p-4 text-left text-xs text-emerald-950 flex items-start gap-3">
          <Mail className="h-5 w-5 shrink-0 text-emerald-700 mt-0.5" />
          <div>
            <span className="font-bold block text-sm mb-0.5">
              {locale === "ar" ? "فاتورة إلكترونية عبر الإيميل" : "Electronic Invoice via Email"}
            </span>
            <p className="text-emerald-900 leading-normal">
              {t.checkout.success.emailNotice(placedOrder.customer.email)}
            </p>
          </div>
        </div>

        {/* Cash on Delivery Notice Banner */}
        <div className="mt-3 rounded border border-line-light bg-line-light/30 p-4 text-left text-xs text-charcoal flex items-start gap-3">
          <Truck className="h-5 w-5 shrink-0 text-obsidian mt-0.5" />
          <div>
            <span className="font-bold block text-sm mb-0.5">
              {locale === "ar" ? "الدفع عند الاستلام والمعاينة" : "Cash on Delivery & Inspection"}
            </span>
            <p className="text-graphite leading-normal">
              {t.checkout.success.codNotice}
            </p>
          </div>
        </div>

        {/* Order Breakdown Card */}
        <div className="mt-6 rounded border border-line-light bg-off-white p-5 text-left text-xs">
          <h2 className="font-bold text-sm text-obsidian mb-3 pb-2 border-b border-line-light">
            {t.checkout.success.orderDetailsTitle}
          </h2>
          <div className="divide-y divide-line-light space-y-2">
            {placedOrder.items.map((it, idx) => (
              <div key={idx} className="pt-2 flex justify-between items-center">
                <span>
                  <strong>{it.productName}</strong> ({it.size}) × {it.qty}
                </span>
                <span className="font-mono font-semibold">
                  {formatPrice((it.priceCentsSnapshot / 100) * it.qty)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-line-light space-y-1.5 text-graphite">
            <div className="flex justify-between">
              <span>{t.checkout.summary.subtotal}</span>
              <span className="font-mono">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t.checkout.summary.shipping}</span>
              <span className="font-mono">
                {finalShipping === 0 ? t.checkout.summary.shippingFree : formatPrice(finalShipping)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-bold text-obsidian pt-2 border-t border-line-light">
              <span>{t.checkout.summary.total}</span>
              <span className="font-mono">{formatPrice(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Customer & Address Details */}
        <div className="mt-4 rounded border border-line-light bg-off-white p-4 text-left text-xs text-graphite space-y-2">
          <h3 className="font-bold text-obsidian">{t.checkout.success.customerInfoTitle}</h3>
          <div className="flex items-center gap-2">
            <span className="font-medium text-obsidian">{placedOrder.customer.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-graphite" />
            <span>{placedOrder.customer.phone}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-graphite" />
            <span>
              {placedOrder.customer.address}, {placedOrder.customer.city}
            </span>
          </div>
        </div>

        <div className="mt-8">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center gap-2 rounded bg-obsidian px-8 py-3.5 text-sm font-bold text-off-white hover:bg-charcoal transition-colors duration-200"
          >
            {t.checkout.success.continueShopping}
          </Link>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-16 text-center max-w-lg mx-auto">
        <h1 className="text-2xl font-extrabold text-obsidian">{t.checkout.emptyCartTitle}</h1>
        <p className="mt-3 text-graphite text-sm">{t.checkout.emptyCartDesc}</p>
        <Link
          href="/shop"
          className="mt-6 inline-block rounded bg-obsidian px-6 py-3 text-sm font-bold text-off-white hover:bg-charcoal"
        >
          {t.checkout.browseCatalog}
        </Link>
      </div>
    );
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 3) {
      errs.name = t.checkout.errors.nameRequired;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) {
      errs.phone = t.checkout.errors.phoneRequired;
    } else if (cleanPhone.length < 10 || cleanPhone.length > 12) {
      errs.phone = t.checkout.errors.phoneInvalid;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!email.trim()) {
      errs.email = t.checkout.errors.emailRequired;
    } else if (!emailPattern.test(email.trim())) {
      errs.email = t.checkout.errors.emailInvalid;
    }

    if (!city.trim()) {
      errs.city = t.checkout.errors.cityRequired;
    }
    if (!address.trim() || address.trim().length < 5) {
      errs.address = t.checkout.errors.addressRequired;
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);

    const combinedNotes = [
      notes.trim(),
      appliedPromo ? `[كود الخصم: ${appliedPromo.code} - خصم ${appliedPromo.discountPercent}%]` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const checkoutInput = {
      customer: {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        city: city.trim(),
        address: address.trim(),
      },
      notes: combinedNotes,
      promoCode: appliedPromo?.code || "",
      items: rows.map((r) => ({
        productSlug: r.product.slug,
        productName: r.product.name,
        size: r.size,
        qty: r.qty,
        priceCents: r.product.price * 100,
      })),
    };

    try {
      const apiRes = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutInput),
      });
      const resData = await apiRes.json();

      const order = resData.data || resData.order;
      if (apiRes.ok && resData.ok && order) {
        clear();
        setPlacedOrder(order);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setFormErrors({ submit: resData.error?.message || resData.error || "حدث خطأ أثناء تسجيل الطلب. يرجى المحاولة مرة أخرى." });
      }
    } catch {
      setFormErrors({ submit: "تعذر الاتصال بالخادم لتسجيل الطلب. يرجى التحقق من اتصالك بالإنترنت." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="py-6">
      {/* Header */}
      <div className="mb-8 border-b border-line-light pb-6">
        <Link
          href="/cart"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-graphite hover:text-obsidian mb-3"
        >
          {dir === "rtl" ? <ArrowRight className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
          {locale === "ar" ? "العودة إلى سلة التسوق" : "Back to cart"}
        </Link>
        <h1 className="text-3xl font-extrabold text-obsidian tracking-tight">{t.checkout.title}</h1>
        <p className="mt-1 text-sm text-graphite">{t.checkout.subtitle}</p>
      </div>

      <div className="grid gap-10 lg:grid-cols-12 items-start">
        {/* Left Column: Form Details */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-8">
          {/* Section 1: Customer Details */}
          <div className="rounded border border-line-light bg-off-white p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-obsidian">{t.checkout.step1Title}</h2>
              <p className="text-xs text-graphite mt-0.5">{t.checkout.step1Desc}</p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
                {t.checkout.fields.name} <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: "" }));
                }}
                placeholder={t.checkout.fields.namePlaceholder}
                className="w-full rounded border border-graphite bg-off-white px-3.5 py-2.5 text-sm text-obsidian focus:border-obsidian focus:outline-none"
              />
              {formErrors.name && (
                <span className="text-xs text-red-600 mt-1 block font-medium">{formErrors.name}</span>
              )}
            </div>

            {/* Phone & Email Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
                  {t.checkout.fields.phone} <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: "" }));
                  }}
                  placeholder={t.checkout.fields.phonePlaceholder}
                  className="w-full rounded border border-graphite bg-off-white px-3.5 py-2.5 text-sm font-mono text-obsidian focus:border-obsidian focus:outline-none"
                />
                <span className="text-[11px] text-graphite mt-1 block">
                  {t.checkout.fields.phoneHint}
                </span>
                {formErrors.phone && (
                  <span className="text-xs text-red-600 mt-1 block font-medium">{formErrors.phone}</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
                  {t.checkout.fields.email} <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: "" }));
                  }}
                  placeholder={t.checkout.fields.emailPlaceholder}
                  className="w-full rounded border border-graphite bg-off-white px-3.5 py-2.5 text-sm text-obsidian focus:border-obsidian focus:outline-none"
                />
                <span className="text-[11px] text-graphite mt-1 block">
                  {t.checkout.fields.emailHint}
                </span>
                {formErrors.email && (
                  <span className="text-xs text-red-600 mt-1 block font-medium">{formErrors.email}</span>
                )}
              </div>
            </div>

            {/* Governorate Select */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
                {t.checkout.fields.city} <span className="text-red-600">*</span>
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded border border-graphite bg-off-white px-3.5 py-2.5 text-sm text-obsidian focus:border-obsidian focus:outline-none cursor-pointer"
              >
                {EGYPT_GOVERNORATES.map((g) => {
                  const val = locale === "ar" ? g.ar : g.en;
                  return (
                    <option key={g.en} value={val}>
                      {val}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
                {t.checkout.fields.address} <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  if (formErrors.address) setFormErrors((prev) => ({ ...prev, address: "" }));
                }}
                placeholder={t.checkout.fields.addressPlaceholder}
                className="w-full rounded border border-graphite bg-off-white px-3.5 py-2.5 text-sm text-obsidian focus:border-obsidian focus:outline-none"
              />
              {formErrors.address && (
                <span className="text-xs text-red-600 mt-1 block font-medium">{formErrors.address}</span>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
                {t.checkout.fields.notes}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.checkout.fields.notesPlaceholder}
                className="w-full rounded border border-graphite bg-off-white px-3.5 py-2 text-sm text-obsidian focus:border-obsidian focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Section 2: Cash On Delivery & Guarantee Banner */}
          <div className="rounded border-2 border-obsidian bg-off-white p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-obsidian" />
                <h2 className="text-base font-bold text-obsidian">{t.checkout.payment.codTitle}</h2>
              </div>
              <span className="rounded bg-obsidian px-2.5 py-1 text-[11px] font-bold text-off-white uppercase">
                {t.checkout.payment.codBadge}
              </span>
            </div>

            <p className="text-xs text-charcoal leading-relaxed">
              {t.checkout.payment.codDesc}
            </p>

            <div className="rounded bg-line-light/50 p-3 text-xs text-graphite">
              {t.checkout.payment.emailInvoiceNotice}
            </div>
          </div>

          {formErrors.submit && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-xs text-red-700">
              {formErrors.submit}
            </div>
          )}

          {/* Mobile Submit Button (Visible on small screens) */}
          <div className="lg:hidden">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded bg-obsidian py-4 text-base font-bold text-off-white hover:bg-charcoal transition-colors duration-200 cursor-pointer disabled:opacity-50"
            >
              {submitting ? t.checkout.summary.submitting : `${t.checkout.summary.submitBtn} (${formatPrice(grandTotal)})`}
            </button>
          </div>
        </form>

        {/* Right Column: Order Summary Card */}
        <aside className="lg:col-span-5 sticky top-24 rounded border border-line-light bg-off-white p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-line-light pb-4">
            <h2 className="text-lg font-bold text-obsidian">{t.checkout.summary.title}</h2>
            <span className="text-xs font-semibold text-graphite">
              {t.checkout.summary.itemsCount(totalItemCount)}
            </span>
          </div>

          {/* Items List */}
          <ul className="divide-y divide-line-light max-h-80 overflow-y-auto pr-1">
            {rows.map(({ product, size, qty }) => {
              const img = images[product.images[0]];
              return (
                <li key={`${product.slug}-${size}`} className="py-3 flex gap-3 items-center">
                  <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded bg-charcoal">
                    <Image
                      src={img.src}
                      alt={img.alt}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-obsidian truncate">{product.name}</h3>
                    <div className="text-xs text-graphite mt-0.5">
                      {t.cart.size}: <span className="font-mono font-bold text-obsidian">{size}</span> ·{" "}
                      {t.cart.quantity}: <span className="font-mono">{qty}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono text-obsidian">
                      {formatPrice(product.price * qty)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Promo Code Input Card (Securely validated server-side) */}
          <div className="border-t border-line-light pt-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
              {locale === "ar" ? "هل لديك كود خصم؟" : "Have a promo code?"}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                disabled={Boolean(appliedPromo) || promoLoading}
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                placeholder={locale === "ar" ? "مثال: TERRA10" : "e.g. TERRA10"}
                className="flex-1 rounded border border-graphite bg-off-white px-3 py-2 text-xs uppercase font-mono tracking-wider text-obsidian focus:border-obsidian focus:outline-none disabled:opacity-50"
              />
              {appliedPromo ? (
                <button
                  type="button"
                  onClick={handleRemovePromo}
                  className="rounded bg-stone-200 px-3 py-2 text-xs font-bold text-stone-800 hover:bg-stone-300 transition cursor-pointer"
                >
                  {locale === "ar" ? "إلغاء" : "Remove"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  disabled={!promoCodeInput.trim() || promoLoading}
                  className="rounded bg-obsidian px-4 py-2 text-xs font-bold text-off-white hover:bg-charcoal transition cursor-pointer disabled:opacity-50"
                >
                  {promoLoading ? "..." : locale === "ar" ? "تطبيق" : "Apply"}
                </button>
              )}
            </div>
            {promoMessage && (
              <p
                className={`mt-1.5 text-xs font-medium ${
                  promoMessage.type === "success" ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {promoMessage.text}
              </p>
            )}
          </div>

          {/* Pricing Totals */}
          <div className="border-t border-line-light pt-4 space-y-2.5 text-xs text-graphite">
            <div className="flex justify-between">
              <span>{t.checkout.summary.subtotal}</span>
              <span className="font-mono text-obsidian font-semibold">{formatPrice(subtotal)}</span>
            </div>

            {appliedPromo && discountAmount > 0 && (
              <div className="flex justify-between text-emerald-800 font-semibold">
                <span>
                  {locale === "ar" ? `خصم الكوبون (${appliedPromo.code})` : `Discount (${appliedPromo.code})`}
                </span>
                <span className="font-mono">-{formatPrice(discountAmount)}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span>{t.checkout.summary.shipping}</span>
              <span className="font-mono text-obsidian font-semibold">
                {finalShipping === 0 ? (
                  <span className="text-emerald-700 font-bold">{t.checkout.summary.shippingFree}</span>
                ) : (
                  formatPrice(finalShipping)
                )}
              </span>
            </div>

            {isFreeShipping && (
              <div className="rounded bg-emerald-50 text-emerald-800 p-2 text-[11px] font-medium text-center">
                🎉 {locale === "ar" ? "عرض قطعتين أو أكثر: الشحن مجاني لطلبك!" : "Buy 2+ items: You unlocked FREE shipping!"}
              </div>
            )}

            <div className="flex justify-between items-baseline text-base font-extrabold text-obsidian border-t border-line-light pt-3">
              <span>{t.checkout.summary.total}</span>
              <span className="font-mono text-xl">{formatPrice(grandTotal)}</span>
            </div>
          </div>

          {/* Desktop Submit Button */}
          <div className="hidden lg:block pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded bg-obsidian py-4 text-base font-bold text-off-white hover:bg-charcoal transition-colors duration-200 cursor-pointer disabled:opacity-50"
            >
              {submitting ? t.checkout.summary.submitting : t.checkout.summary.submitBtn}
            </button>
            <p className="mt-3 text-[11px] text-graphite text-center">
              {t.checkout.summary.guarantee}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
