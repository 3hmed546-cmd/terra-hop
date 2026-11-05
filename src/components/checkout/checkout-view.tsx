"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, Truck, Phone, MapPin, ArrowRight, ArrowLeft } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale-context";
import { images } from "@/content/images";
import { formatPrice } from "@/lib/format";
import { useCheckoutConfig } from "@/lib/use-checkout-config";
import { useLive } from "@/lib/use-live";
import { WhatsAppIcon } from "@/components/ui/social-icons";
import { home } from "@/content/home";
import type { Product } from "@/content/home";

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
  { ar: "شمال سيناء", en: "North Sinai" },
  { ar: "جنوب سيناء", en: "South Sinai" },
  { ar: "مطروح", en: "Matrouh" },
  { ar: "الوادي الجديد", en: "New Valley" },
];

function normalizeArabicDigits(input: string): string {
  if (!input) return "";
  const easternArabic = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  const persian = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  let res = input;
  for (let i = 0; i <= 9; i++) {
    res = res.replaceAll(easternArabic[i], String(i)).replaceAll(persian[i], String(i));
  }
  return res;
}

export function CheckoutView({ products }: { products: Product[] }) {
  const { lines, clear, ready } = useCart();
  const { locale, t, dir } = useLocale();
  const config = useCheckoutConfig();
  const { data: liveProducts } = useLive("products");

  const effectiveProducts = useMemo<Product[]>(() => {
    if (!Array.isArray(liveProducts) || liveProducts.length === 0) return products;
    return liveProducts.map((product: any) => ({
      slug: product.slug || product.id,
      name: product.name || product.nameAr,
      category: product.category === "tshirt" || product.category === "T-shirts" ? "T-shirts" : "Hoodies",
      price: (product.priceCents || 0) / 100,
      originalPrice: product.compareAtCents ? product.compareAtCents / 100 : undefined,
      status: product.forceSoldOut || product.status === "sold_out" ? "Sold out" : "Preorder",
      description: product.description || product.descriptionAr || "",
      sizes: product.sizes || (product.variants || []).map((variant: any) => variant.size).filter(Boolean),
      images: (product.images || []).map((image: any) => typeof image === "object" ? image.url : image),
      colors: product.colors || [],
      variants: product.variants || [],
      href: `/shop/${product.slug || product.id}`,
      demo: false,
    }));
  }, [liveProducts, products]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState(EGYPT_GOVERNORATES[0][locale === "ar" ? "ar" : "en"]);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<any | null>(null);

  // Promo code state
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountPercent?: number;
    discountCents: number;
  } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoMessage, setPromoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Cart products
  const rows = lines.flatMap((l) => {
    const product = effectiveProducts.find((p) => p.slug === l.slug);
    return product ? [{ ...l, product }] : [];
  });

  const hasSoldOut = rows.some((r) => r.product.status === "Sold out");

  const subtotal = rows.reduce((sum, r) => sum + r.product.price * r.qty, 0);
  const subtotalCents = Math.round(subtotal * 100);
  const totalItemCount = rows.reduce((sum, r) => sum + r.qty, 0);

  // Authoritative shipping from config
  const shippingFee = config.shippingCents / 100;
  const isFreeShipping =
    (config.freeShippingMinQuantity > 0 && totalItemCount >= config.freeShippingMinQuantity) ||
    (config.freeShippingMinAmountCents > 0 && subtotalCents >= config.freeShippingMinAmountCents);
  const finalShipping = isFreeShipping ? 0 : shippingFee;

  const discountAmount = appliedPromo ? Math.round(appliedPromo.discountCents / 100) : 0;
  const grandTotal = Math.max(0, subtotal - discountAmount) + finalShipping;

  async function handleApplyPromo() {
    const clean = normalizeArabicDigits(promoCodeInput).trim().toUpperCase();
    if (!clean) return;
    setPromoLoading(true);
    setPromoMessage(null);
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: clean,
          subtotalCents,
          items: rows.map((r) => ({
            productId: (r.product as any).id || r.product.slug,
            productSlug: r.product.slug,
            qty: r.qty,
            priceCents: r.product.price * 100,
          })),
          phone: phone.trim() || undefined,
          email: email.trim().toLowerCase() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.ok || data.valid)) {
        const discCents =
          data.discountCents ??
          (data.discountPercent ? Math.round((subtotalCents * data.discountPercent) / 100) : 0);
        setAppliedPromo({
          code: data.code,
          discountPercent: data.discountPercent,
          discountCents: discCents,
        });
        setPromoMessage({
          type: "success",
          text:
            data.message ||
            (data.discountPercent
              ? `تم تطبيق خصم ${data.discountPercent}% بنجاح على مشترياتك المؤهلة.`
              : `تم تطبيق خصم ${Math.round(discCents / 100)} ج.م بنجاح.`),
        });
      } else {
        setPromoMessage({
          type: "error",
          text: data.error || "كود الخصم غير صحيح أو غير متاح حالياً.",
        });
      }
    } catch {
      setPromoMessage({ type: "error", text: "تعذر التحقق من كود الخصم حالياً." });
    } finally {
      setPromoLoading(false);
    }
  }

  function handleRemovePromo() {
    setAppliedPromo(null);
    setPromoCodeInput("");
    setPromoMessage(null);
  }

  if (!ready) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-obsidian border-r-transparent" />
      </div>
    );
  }

  if (placedOrder) {
    const orderItems: any[] = placedOrder.items || [];
    const orderSubtotal =
      placedOrder.subtotal != null
        ? placedOrder.subtotal
        : placedOrder.subtotalCents != null
        ? Math.round(placedOrder.subtotalCents / 100)
        : subtotal;

    const orderShipping =
      placedOrder.shipping != null
        ? placedOrder.shipping
        : placedOrder.shippingCents != null
        ? Math.round(placedOrder.shippingCents / 100)
        : finalShipping;

    const orderDiscount =
      placedOrder.discount != null
        ? placedOrder.discount
        : placedOrder.discountCents != null
        ? Math.round(placedOrder.discountCents / 100)
        : discountAmount;

    const orderTotal =
      placedOrder.total != null
        ? placedOrder.total
        : placedOrder.totalCents != null
        ? Math.round(placedOrder.totalCents / 100)
        : grandTotal;

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

        {/* Confirmation & Shipping Notice Banner */}
        <div className="mt-6 rounded border border-emerald-300 bg-emerald-50/90 p-4 text-right text-xs text-emerald-950 flex items-start gap-3">
          <Truck className="h-5 w-5 shrink-0 text-emerald-700 mt-0.5" />
          <div>
            <span className="font-bold block text-sm mb-0.5">
              {locale === "ar" ? "تفقد بريدك الإلكتروني لتأكيد الأوردر ✉️" : "Check Your Email To Confirm Order"}
            </span>
            <p className="text-emerald-900 leading-normal">
              {locale === "ar"
                ? "تم إرسال الفاتورة ورابط تأكيد طلبك إلى بريدك الإلكتروني. يرجى فتح الإيميل والضغط على «تأكيد الأوردر الآن» لنبدأ في تجهيز شحنتك فوراً."
                : "Your invoice & confirmation link have been sent to your email. Please click 'Confirm Order' to begin dispatch."}
            </p>
          </div>
        </div>

        {/* Cash on Delivery Notice Banner */}
        <div className="mt-3 rounded border border-line-light bg-line-light/30 p-4 text-left text-xs text-charcoal flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-obsidian mt-0.5" />
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
            {orderItems.map((it, idx) => {
              const itemPrice =
                it.price != null
                  ? it.price
                  : it.priceCentsSnapshot != null
                  ? Math.round(it.priceCentsSnapshot / 100)
                  : it.priceCents != null
                  ? Math.round(it.priceCents / 100)
                  : 0;

              return (
                <div key={idx} className="pt-2 flex justify-between items-center">
                  <span>
                    <strong>{it.productName}</strong> ({it.size}) × {it.qty}
                  </span>
                  <span className="font-mono font-semibold">
                    {formatPrice(itemPrice * it.qty)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-line-light space-y-1.5 text-graphite">
            <div className="flex justify-between">
              <span>{t.checkout.summary.subtotal}</span>
              <span className="font-mono">{formatPrice(orderSubtotal)}</span>
            </div>
            {orderDiscount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>{locale === "ar" ? "الخصم" : "Discount"}</span>
                <span className="font-mono">-{formatPrice(orderDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>{t.checkout.summary.shipping}</span>
              <span className="font-mono">
                {orderShipping === 0 ? t.checkout.summary.shippingFree : formatPrice(orderShipping)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-bold text-obsidian pt-2 border-t border-line-light">
              <span>{t.checkout.summary.total}</span>
              <span className="font-mono">{formatPrice(orderTotal)}</span>
            </div>
          </div>
        </div>

        {/* Customer & Address Details */}
        {placedOrder.customer && (
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
        )}

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
    const cleanPhone = phone.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[^\d+]/g, "");
    if (!cleanPhone) {
      errs.phone = t.checkout.errors.phoneRequired;
    } else if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      errs.phone = t.checkout.errors.phoneInvalid;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!email.trim()) {
      errs.email = locale === "ar" ? "البريد الإلكتروني مطلوب لإرسال الفاتورة وتأكيد الطلب" : "Email is required to send your invoice & order confirmation";
    } else if (!emailPattern.test(email.trim())) {
      errs.email = t.checkout.errors.emailInvalid;
    }

    if (!city.trim()) {
      errs.city = t.checkout.errors.cityRequired;
    }
    if (!address.trim() || address.trim().length < 5) {
      errs.address = t.checkout.errors.addressRequired;
    }

    if (rows.some((r) => r.product.status === "Sold out")) {
      errs.general = locale === "ar" ? "يوجد منتج نفذ من المخزن في طلبك، يرجى حذفه للمتابعة" : "Some items in your cart are sold out";
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || submitting) return;

    setSubmitting(true);
    setFormErrors({});

    const checkoutInput = {
      customer: {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase() || undefined,
        city: city.trim(),
        address: address.trim(),
      },
      notes: notes.trim() || undefined,
      promoCode: appliedPromo?.code || "",
      paymentMethod: "cod",
      items: rows.map((r) => ({
        productSlug: r.product.slug,
        productName: r.product.name,
        size: r.size,
        color: r.color,
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
      const resData = await apiRes.json().catch(() => null);

      if (apiRes.ok && resData?.ok && resData?.data) {
        setPlacedOrder(resData.data);
        clear();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const errMsg =
          resData?.error?.message ||
          resData?.error ||
          (apiRes.status === 429
            ? "تم تجاوز الحد المسموح لتسجيل الطلبات. يرجى الانتظار قليلاً ثم المحاولة."
            : "حدث خطأ أثناء تسجيل الطلب. يرجى التحقق من البيانات والمحاولة مجدداً.");
        setFormErrors({ submit: errMsg });
      }
    } catch {
      setFormErrors({ submit: "تعذر الاتصال بالخادم لتسجيل الطلب. يرجى التحقق من اتصالك بالإنترنت." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-w-0 w-full max-w-full py-5 sm:py-6 overflow-hidden">
      {/* Header */}
      <div className="mb-8 border-b border-line-light pb-6 w-full max-w-full">
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

      <div className="grid min-w-0 gap-6 sm:gap-8 lg:grid-cols-12 lg:gap-10 items-start">
        {/* Left Column: Form Details */}
        <form onSubmit={handleSubmit} className="min-w-0 space-y-6 sm:space-y-8 lg:col-span-7" noValidate>
          {/* Section 1: Customer Details */}
          <div className="min-w-0 rounded border border-line-light bg-off-white p-4 space-y-4 sm:p-6">
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
                  {locale === "ar" ? "ستصلك الفاتورة ورابط تأكيد طلبك على هذا الإيميل" : t.checkout.fields.emailHint}
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
          <div className="min-w-0 rounded border-2 border-obsidian bg-off-white p-4 space-y-3 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-obsidian" />
                <h2 className="text-base font-bold text-obsidian break-words">{t.checkout.payment.codTitle}</h2>
              </div>
              <span className="shrink-0 rounded bg-obsidian px-2.5 py-1 text-[11px] font-bold text-off-white uppercase">
                {t.checkout.payment.codBadge}
              </span>
            </div>

            <p className="text-xs text-charcoal leading-relaxed">
              {t.checkout.payment.codDesc}
            </p>
          </div>

          {formErrors.submit && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-xs text-red-700 font-medium">
              {formErrors.submit}
            </div>
          )}

          {/* Mobile Submit Button */}
          <div className="lg:hidden">
            {hasSoldOut ? (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled
                  className="w-full rounded bg-stone-300 py-4 text-base font-bold text-stone-500 cursor-not-allowed opacity-70"
                >
                  {t.checkout.summary.submitBtn}
                </button>
                <p className="text-xs text-red-600 font-bold text-center">
                  {locale === "ar" ? "يوجد منتج نفذ من المخزن في طلبك. يرجى حذفه لمتابعة الشراء." : "Some items in your cart are sold out."}
                </p>
                <a
                  href={home.signup.whatsappGroupUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 px-4 font-bold text-xs bg-stone-900 hover:bg-black text-white transition shadow-sm"
                >
                  <WhatsAppIcon className="w-4 h-4 fill-current text-emerald-400" />
                  <span>{locale === "ar" ? "انضم لجروب الواتساب لمتابعة التوفر" : "Join WhatsApp Group"}</span>
                </a>
              </div>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded bg-obsidian py-4 text-base font-bold text-off-white hover:bg-charcoal transition-colors duration-200 cursor-pointer disabled:opacity-50"
              >
                {submitting
                  ? t.checkout.summary.submitting
                  : `${t.checkout.summary.submitBtn} (${formatPrice(grandTotal)})`}
              </button>
            )}
          </div>
        </form>

        {/* Right Column: Order Summary Card */}
        <aside className="min-w-0 rounded border border-line-light bg-off-white p-4 space-y-5 sm:p-6 sm:space-y-6 lg:sticky lg:top-24 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-line-light pb-4">
            <h2 className="text-lg font-bold text-obsidian">{t.checkout.summary.title}</h2>
            <span className="text-xs font-semibold text-graphite">
              {t.checkout.summary.itemsCount(totalItemCount)}
            </span>
          </div>

          {/* Items List */}
          <ul className="max-h-80 divide-y divide-line-light overflow-x-hidden overflow-y-auto pe-1">
            {rows.map(({ product, size, qty, color, colorHex, image }) => {
              const firstImg = product.images[0];
              const isDirectUrl = typeof firstImg === "string" && (firstImg.startsWith("/") || firstImg.startsWith("http"));
              const matchedImg = isDirectUrl ? null : images[firstImg];
              const defaultSrc = isDirectUrl ? firstImg : (matchedImg?.src || "/products/burgundy-hoodie-model.jpg");
              const imgSrc = image || defaultSrc;
              const imgAlt = matchedImg?.alt || product.name;
              return (
                <li key={`${product.slug}-${size}-${color || "default"}`} className="flex min-w-0 items-center gap-3 py-3">
                  <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded bg-charcoal">
                    <Image
                      src={imgSrc}
                      alt={imgAlt}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-obsidian truncate">{product.name}</h3>
                    <div className="text-xs text-graphite mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span>
                        {t.cart.size}: <span className="font-mono font-bold text-obsidian">{size}</span>
                      </span>
                      {color && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            {colorHex && (
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-stone-300"
                                style={{ backgroundColor: colorHex }}
                              />
                            )}
                            <strong className="text-obsidian">{color}</strong>
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span>
                        {t.cart.quantity}: <span className="font-mono">{qty}</span>
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="whitespace-nowrap text-sm font-bold font-mono text-obsidian">
                      {formatPrice(product.price * qty)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Promo Code Input Card */}
          <div className="border-t border-line-light pt-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
              {locale === "ar" ? "هل لديك كود خصم؟" : "Have a promo code?"}
            </label>
            <div className="flex min-w-0 gap-2">
              <input
                type="text"
                disabled={Boolean(appliedPromo) || promoLoading}
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyPromo();
                  }
                }}
                placeholder={locale === "ar" ? "أدخل كود الخصم" : "Enter promo code"}
                className="min-w-0 flex-1 rounded border border-graphite bg-off-white px-3 py-2 text-xs uppercase font-mono tracking-wider text-obsidian focus:border-obsidian focus:outline-none disabled:opacity-50"
              />
              {appliedPromo ? (
                <button
                  type="button"
                  onClick={handleRemovePromo}
                  className="rounded border border-obsidian px-3 py-2 text-xs font-bold text-obsidian hover:bg-stone-200 transition cursor-pointer"
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
                {locale === "ar" ? "عرض قطعتين أو أكثر: الشحن مجاني لطلبك!" : "Buy 2+ items: You unlocked FREE shipping!"}
              </div>
            )}

            <div className="flex justify-between items-baseline text-base font-extrabold text-obsidian border-t border-line-light pt-3">
              <span>{t.checkout.summary.total}</span>
              <span className="font-mono text-xl">{formatPrice(grandTotal)}</span>
            </div>
          </div>

          {/* Desktop Submit Button */}
          <div className="hidden lg:block pt-2">
            {hasSoldOut ? (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled
                  className="w-full rounded bg-stone-300 py-4 text-base font-bold text-stone-500 cursor-not-allowed opacity-70"
                >
                  {t.checkout.summary.submitBtn}
                </button>
                <p className="text-xs text-red-600 font-bold text-center">
                  {locale === "ar" ? "يوجد منتج نفذ من المخزن في طلبك. يرجى حذفه لمتابعة الشراء." : "Some items in your cart are sold out."}
                </p>
                <a
                  href={home.signup.whatsappGroupUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 px-4 font-bold text-xs bg-stone-900 hover:bg-black text-white transition shadow-sm"
                >
                  <WhatsAppIcon className="w-4 h-4 fill-current text-emerald-400" />
                  <span>{locale === "ar" ? "انضم لجروب الواتساب لمتابعة التوفر" : "Join WhatsApp Group"}</span>
                </a>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
