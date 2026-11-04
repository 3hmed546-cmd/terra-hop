"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Truck,
  CreditCard,
  Eye,
  Ruler,
  Share2,
  Check,
  ShoppingBag,
  Zap,
  X,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Phone,
} from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { images, resolveImage } from "@/content/images";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale-context";
import { StatusLabel } from "@/components/ui/status-label";
import { useLive } from "@/lib/use-live";
import type { Product } from "@/content/home";

type Props = {
  product: Product;
  allProducts?: Product[];
};

export function ProductDetailView({ product, allProducts = [] }: Props) {
  const router = useRouter();
  const { add } = useCart();
  const { locale, t } = useLocale();

  const { data: liveProducts } = useLive("products");
  const matchedAdmin = Array.isArray(liveProducts)
    ? liveProducts.find((p: any) => p.slug === product.slug || p.id === product.slug)
    : null;

  // Live dynamic images mapping (synced with admin store & API)
  const shots = useMemo(() => {
    if (matchedAdmin?.images && matchedAdmin.images.length > 0) {
      return matchedAdmin.images.map((img: any) => {
        const url = typeof img === "string" ? img : img.url;
        const alt = typeof img === "object" ? img.alt : "";
        const resolved = resolveImage(url);
        return {
          ...resolved,
          src: url,
          alt: alt || resolved.alt || product.name,
        };
      });
    }
    return product.images.map((slot) => resolveImage(slot));
  }, [matchedAdmin?.images, product.images, product.name]);

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Sold out determination (Live static from DB & admin settings)
  const isSoldOut = matchedAdmin
    ? matchedAdmin.forceSoldOut === true || matchedAdmin.status === "sold_out"
    : product.status === "Sold out" || product.status === "sold_out";

  // Product colors strictly from admin data or product configuration
  const productColors = useMemo(() => {
    if (matchedAdmin?.colors && Array.isArray(matchedAdmin.colors) && matchedAdmin.colors.length > 0) {
      return matchedAdmin.colors;
    }
    if ((product as any).colors && Array.isArray((product as any).colors) && (product as any).colors.length > 0) {
      return (product as any).colors;
    }
    return [];
  }, [matchedAdmin?.colors, (product as any).colors]);

  const [selectedColor, setSelectedColor] = useState<any>(() => {
    return productColors.length > 0 ? productColors[0] : null;
  });
  const [customActiveImage, setCustomActiveImage] = useState<string | null>(null);

  useEffect(() => {
    if (productColors.length > 0) {
      if (!selectedColor || !productColors.some((c: any) => c.id === selectedColor.id)) {
        setSelectedColor(productColors[0]);
      }
    }
  }, [productColors, selectedColor]);

  const isColorOutOfStock = (colorId: string) => {
    if (isSoldOut) return true;
    if (!matchedAdmin?.variants || !Array.isArray(matchedAdmin.variants) || matchedAdmin.variants.length === 0) {
      return false;
    }
    const colorVariants = matchedAdmin.variants.filter((v: any) => String(v.colorId) === String(colorId));
    if (colorVariants.length === 0) return false;
    return colorVariants.every((v: any) => (v.stock ?? 0) <= 0 || v.available === false);
  };

  // Keep index within bounds if shots change
  useEffect(() => {
    if (activeImageIndex >= shots.length) {
      setActiveImageIndex(0);
    }
  }, [shots.length, activeImageIndex]);

  // Size selection and availability
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<"idle" | "error" | "added">("idle");
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Sizes to display: from admin product configuration or defaults
  const displaySizes = useMemo<string[]>(() => {
    if (matchedAdmin?.sizes && Array.isArray(matchedAdmin.sizes) && matchedAdmin.sizes.length > 0) {
      return Array.from(new Set<string>(matchedAdmin.sizes.map((s: string) => String(s).toUpperCase())));
    }
    if (matchedAdmin?.variants && Array.isArray(matchedAdmin.variants) && matchedAdmin.variants.length > 0) {
      const list = Array.from(new Set<string>(matchedAdmin.variants.map((v: any) => String(v.size || "").toUpperCase()))).filter(Boolean);
      if (list.length > 0) return list;
    }
    const base: readonly string[] = product.sizes && product.sizes.length > 0 ? product.sizes : ["S", "M", "L", "XL", "XXL"];
    return Array.from(new Set<string>(base.map((s) => String(s).toUpperCase())));
  }, [matchedAdmin?.sizes, matchedAdmin?.variants, product.sizes]);

  // Determine which sizes are available vs out-of-stock (with X mark) for selected color
  const availableSizes = useMemo(() => {
    if (!matchedAdmin?.variants || !Array.isArray(matchedAdmin.variants) || matchedAdmin.variants.length === 0) {
      return new Set(displaySizes);
    }

    const scopedVariants = selectedColor
      ? matchedAdmin.variants.filter((v: any) => String(v.colorId).toLowerCase() === String(selectedColor.id).toLowerCase())
      : matchedAdmin.variants;

    const targetVariants = scopedVariants.length > 0 ? scopedVariants : matchedAdmin.variants;

    const active = targetVariants
      .filter((v: any) => {
        const stock = typeof v.stock === "number" ? v.stock : 0;
        return stock > 0 && v.available !== false;
      })
      .map((v: any) => String(v.size).toUpperCase());

    return new Set(active);
  }, [matchedAdmin?.variants, selectedColor, displaySizes]);

  // Auto-select first available size when availableSizes changes
  useEffect(() => {
    if (selectedSize && !availableSizes.has(selectedSize)) {
      const firstAvail = displaySizes.find((s) => availableSizes.has(s));
      setSelectedSize(firstAvail || null);
    } else if (!selectedSize && availableSizes.size > 0) {
      const firstAvail = displaySizes.find((s) => availableSizes.has(s));
      if (firstAvail) setSelectedSize(firstAvail);
    }
  }, [availableSizes, displaySizes, selectedSize]);

  // Accordion open states
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    description: true,
    shipping: false,
    returns: false,
  });

  // Sticky bottom bar visibility
  const [showStickyBar, setShowStickyBar] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when Size Guide modal is active so user cannot scroll underneath it
  useEffect(() => {
    if (showSizeGuide) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [showSizeGuide]);

  useEffect(() => {
    const handleScroll = () => {
      if (!actionsRef.current) return;
      const rect = actionsRef.current.getBoundingClientRect();
      setShowStickyBar(rect.bottom < 0);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const localizedName =
    locale === "ar" && t.products[product.slug]?.name
      ? t.products[product.slug].name
      : (matchedAdmin?.name || product.name);

  const localizedDesc =
    locale === "ar" && t.products[product.slug]?.description
      ? t.products[product.slug].description
      : (matchedAdmin?.description || product.description);

  const localizedStatus = isSoldOut
    ? (locale === "ar" ? "نفذ من المخزن" : "Sold Out")
    : (locale === "ar" ? t.drop.preorderBadge : (product.status ?? "PREORDER"));

  const currentPrice = matchedAdmin ? (matchedAdmin.priceCents / 100) : product.price;
  const currentOriginalPrice = matchedAdmin?.compareAtCents ? (matchedAdmin.compareAtCents / 100) : product.originalPrice;

  // Discount calculation
  const hasDiscount = !!currentOriginalPrice && currentOriginalPrice > currentPrice;
  const savedAmount = hasDiscount ? (currentOriginalPrice! - currentPrice) : 0;
  const discountPercent = hasDiscount
    ? Math.round(((currentOriginalPrice! - currentPrice) / currentOriginalPrice!) * 100)
    : 0;

  // Image Navigation
  const prevImage = () => {
    setCustomActiveImage(null);
    setActiveImageIndex((prev) => (prev === 0 ? shots.length - 1 : prev - 1));
  };
  const nextImage = () => {
    setCustomActiveImage(null);
    setActiveImageIndex((prev) => (prev === shots.length - 1 ? 0 : prev + 1));
  };

  const scrollThumbnails = (direction: "left" | "right") => {
    if (!thumbnailsRef.current) return;
    const amount = direction === "left" ? -120 : 120;
    thumbnailsRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  const currentMainSrc = customActiveImage || shots[activeImageIndex]?.src || "";

  // Add to Cart handler
  const handleAddToCart = () => {
    if (isSoldOut) return;
    if (!selectedSize) {
      setActionStatus("error");
      return;
    }
    add(product.slug, selectedSize, {
      name: selectedColor?.name,
      hex: selectedColor?.hex,
      image: currentMainSrc,
    });
    setActionStatus("added");
  };

  // Buy Now handler
  const handleBuyNow = () => {
    if (isSoldOut) return;
    if (!selectedSize) {
      setActionStatus("error");
      return;
    }
    add(product.slug, selectedSize, {
      name: selectedColor?.name,
      hex: selectedColor?.hex,
      image: currentMainSrc,
    });
    router.push("/checkout");
  };

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const relatedProducts = allProducts.filter((p) => p.slug !== product.slug);

  return (
    <PageShell>
      {/* 1. Breadcrumbs */}
      <nav
        aria-label="Breadcrumbs"
        className="mb-4 flex items-center gap-2 text-xs text-graphite font-medium"
      >
        <Link href="/" className="hover:text-obsidian hover:underline">
          {t.productPage.breadcrumbHome}
        </Link>
        <span>/</span>
        <Link href="/shop" className="hover:text-obsidian hover:underline">
          {t.productPage.breadcrumbShop}
        </Link>
        <span>/</span>
        <span className="text-obsidian font-bold truncate max-w-[200px] sm:max-w-none">
          {localizedName}
        </span>
      </nav>

      {/* 2. Main Product Grid: Gallery on the Right, Details on the Left (Reference Image 4) */}
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-12 items-start">
        {/* Left Column on Desktop (order-2 on mobile, order-1 on lg): Title, Pricing, Sizes, Actions, Accordions */}
        <div className="lg:col-span-5 order-2 lg:order-1 space-y-5">
          {/* Title */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-obsidian tracking-tight leading-tight">
              {localizedName}
            </h1>
          </div>

          {/* Pricing Section (Matching Reference Image 1: Testatoro style) */}
          <div className="pt-1 pb-3 border-b border-line-light space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              {/* Discount Percentage Pill [-21%] */}
              {hasDiscount && (
                <span
                  className="inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs sm:text-sm font-black text-white shadow-xs tracking-wider"
                  style={{ backgroundColor: "#c8102e", color: "#ffffff" }}
                >
                  -{discountPercent}%
                </span>
              )}

              {/* Discounted Price: Bold Red EGP 1,100 */}
              <span
                className="text-3xl sm:text-4xl font-mono font-black tracking-tight"
                style={{ color: "#c8102e" }}
              >
                {formatPrice(currentPrice)}
              </span>

              {/* Original Price: Gray Strikethrough EGP 1,400 */}
              {hasDiscount && (
                <span
                  className="text-base sm:text-lg font-mono line-through font-semibold"
                  style={{ color: "#78716c" }}
                >
                  {formatPrice(currentOriginalPrice!)}
                </span>
              )}
            </div>

            {/* Savings Pill Underneath: [ وفّرت 300 جنيه ] (Reference Image 1) */}
            {hasDiscount && (
              <div>
                <span
                  className="inline-flex items-center rounded-full px-3.5 py-1 text-xs sm:text-sm font-bold shadow-2xs"
                  style={{ backgroundColor: "#fdedee", color: "#b91c1c" }}
                >
                  {locale === "ar"
                    ? `وفّرت ${savedAmount} جنيه`
                    : `Save EGP ${savedAmount}`}
                </span>
              </div>
            )}
          </div>

          {/* Color Selection Section (Swatches Only - No text names) */}
          {productColors.length > 0 && (
            <div className="pt-2 pb-1 border-b border-line-light">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-obsidian flex items-center gap-1.5">
                  <span>{locale === "ar" ? "اللون" : "Color"}</span>
                </span>
              </div>
              <div role="group" aria-label="Select Color" className="flex flex-wrap items-center gap-2.5 mb-3">
                {productColors.map((c: any) => {
                  const isSelected = selectedColor?.id === c.id;
                  const outOfStock = isColorOutOfStock(c.id);
                  const colorHex = /^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : "#080808";

                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={outOfStock}
                      onClick={() => {
                        if (outOfStock) return;
                        setSelectedColor(c);
                        if (c.image) {
                          setCustomActiveImage(c.image);
                          const idx = shots.findIndex((s: any) => s.src === c.image);
                          if (idx !== -1) setActiveImageIndex(idx);
                        } else {
                          setCustomActiveImage(null);
                        }
                      }}
                      title={`${c.name || "لون"}${outOfStock ? (locale === "ar" ? " (غير متوفر)" : " (Out of Stock)") : ""}`}
                      className={`relative w-8 h-8 rounded-full transition-all duration-150 flex items-center justify-center cursor-pointer ${
                        isSelected
                          ? "ring-2 ring-offset-2 ring-stone-900 scale-110 shadow-sm"
                          : "hover:scale-105 shadow-2xs border border-black/20"
                      } ${outOfStock ? "opacity-40 cursor-not-allowed hover:scale-100" : ""}`}
                      style={{ backgroundColor: colorHex }}
                    >
                      {outOfStock && (
                        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="w-[125%] h-[2px] bg-red-600 -rotate-45 transform origin-center shadow-xs" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size Selection Section (Reference Image 4: Testatoro style) */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-sm font-bold text-obsidian flex items-center gap-1.5">
                <span>{locale === "ar" ? "المقاس" : "Size"}</span>
                {selectedSize && (
                  <span className="text-stone-500 font-semibold text-xs">
                    ({selectedSize})
                  </span>
                )}
              </div>

              {/* Size Guide Trigger - Neutral black, NO red */}
              <button
                type="button"
                onClick={() => setShowSizeGuide(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-obsidian hover:text-black hover:underline cursor-pointer"
              >
                <Ruler className="h-4 w-4 text-obsidian" />
                <span>{t.productPage.sizeGuideBtn}</span>
              </button>
            </div>

            {/* Size Chips - Testatoro style: Solid black when selected, clean white when unselected, X-mark for out-of-stock */}
            <div role="group" aria-label="Select Size" className="flex flex-wrap gap-2.5">
              {displaySizes.map((s: string) => {
                const isAvailable = !isSoldOut && availableSizes.has(s);
                const isSelected = s === selectedSize;

                if (!isAvailable) {
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled
                      title={locale === "ar" ? `مقاس ${s} غير متوفر حالياً` : `Size ${s} Out of Stock`}
                      className="h-11 min-w-14 rounded-lg border border-dashed border-stone-300 bg-stone-100 text-stone-400 text-sm font-bold opacity-60 line-through cursor-not-allowed relative flex items-center justify-center select-none"
                    >
                      <span>{s}</span>
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-stone-500 text-[9px] text-white font-black leading-none shadow-xs">
                        ✕
                      </span>
                    </button>
                  );
                }

                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSelectedSize(s);
                      if (actionStatus === "error") setActionStatus("idle");
                    }}
                    className={`h-11 min-w-14 rounded-lg border text-sm font-bold transition-all duration-150 cursor-pointer ${
                      isSelected ? "scale-102 shadow-sm" : "hover:border-stone-400 shadow-2xs"
                    }`}
                    style={{
                      borderColor: isSelected ? "#080808" : "#d6d3d1",
                      backgroundColor: isSelected ? "#080808" : "#ffffff",
                      color: isSelected ? "#ffffff" : "#080808",
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>

            {/* Warning Alert if size not selected */}
            {actionStatus === "error" && (
              <div
                className="mt-3 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs sm:text-sm font-bold shadow-xs"
                style={{ backgroundColor: "#fef2f2", borderColor: "#fca5a5", color: "#c8102e" }}
              >
                <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "#c8102e" }} />
                <span style={{ color: "#c8102e" }}>{t.productPage.sizeError}</span>
              </div>
            )}

            {/* Success Alert if added to cart */}
            {actionStatus === "added" && (
              <div
                className="mt-3 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs sm:text-sm font-bold shadow-xs"
                style={{ backgroundColor: "#ecfdf5", borderColor: "#a7f3d0", color: "#047857" }}
              >
                <Check className="h-4 w-4 shrink-0" style={{ color: "#059669" }} />
                <span style={{ color: "#047857" }}>
                  {t.productPage.added}{" "}
                  <Link
                    href="/cart"
                    className="underline underline-offset-4 ml-1"
                    style={{ color: "#065f46" }}
                  >
                    {t.productPage.viewCart}
                  </Link>
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons: Add to Cart (Top) & Buy Now (Bottom) OR Sold-Out WhatsApp Invite */}
          <div ref={actionsRef} className="pt-2">
            {isSoldOut ? (
              <div className="rounded-2xl border-2 border-stone-900 bg-[#F4F1EB] p-5 sm:p-6 space-y-4 shadow-sm" dir="rtl">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-stone-900 text-white flex items-center justify-center font-black text-lg shrink-0">
                    ✕
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base sm:text-lg text-stone-900">هذا المنتج نفذ من المخزن حالياً</h3>
                    <p className="text-xs text-stone-600 font-medium mt-0.5">الكميات المتاحة انتهت بالكامل وجاري إنتاج الدفعة القادمة.</p>
                  </div>
                </div>

                <div className="text-xs text-stone-700 leading-relaxed bg-white p-3.5 rounded-xl border border-stone-200 font-medium">
                  انضم إلى مجتمع TERRA HOP على الواتساب لتكون أول من يعلم عند فتح باب الحجز وإعادة توفر هذا الهودي وطلب مقاسك فوراً.
                </div>

                <a
                  href={`https://wa.me/201285694670?text=${encodeURIComponent(
                    `مرحباً TERRA HOP، أود الانضمام لجروب الواتساب ومعرفة موعد توفر هودي "${localizedName}".`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl py-3.5 px-4 font-bold text-xs sm:text-sm bg-stone-900 hover:bg-black text-white transition-all shadow-md cursor-pointer hover:scale-[1.01]"
                >
                  <Phone className="w-4 h-4 fill-current text-emerald-400" />
                  <span>انضم لجروب الواتساب لتصلك تنبيهات التوفر</span>
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 1. Add to Cart (أضف إلى العربة) */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full rounded-xl border-2 border-stone-900 bg-white hover:bg-stone-50 text-stone-900 py-3.5 px-6 text-base font-extrabold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99] shadow-xs"
                >
                  <ShoppingBag className="h-5 w-5 text-stone-900" />
                  <span>{t.productPage.add}</span>
                </button>

                {/* 2. Buy Now (شراء الآن) */}
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="w-full rounded-xl border-2 py-3.5 px-6 text-base font-black transition-all duration-200 cursor-pointer shadow-md shadow-red-600/20 flex items-center justify-center active:scale-[0.99]"
                  style={{ backgroundColor: "#c8102e", borderColor: "#c8102e", color: "#ffffff" }}
                >
                  <span>{t.productPage.buyNow}</span>
                </button>
              </div>
            )}
          </div>

          {/* Trust Highlights Box with Colorful Icon Circles (Reference Image 5) */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3.5 text-xs text-obsidian shadow-xs">
            {/* 1. Free Shipping */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-700 shadow-xs">
                <Truck className="h-4 w-4" />
              </div>
              <span className="font-bold text-slate-800">
                {t.productPage.trustFeatures.shipping}
              </span>
            </div>

            {/* 2. Payment & COD */}
            <div className="border-t border-slate-200/80 pt-2.5 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 border border-blue-200 text-blue-700 shadow-xs">
                <CreditCard className="h-4 w-4" />
              </div>
              <span className="font-bold text-slate-800">
                {t.productPage.trustFeatures.payment}
              </span>
            </div>

            {/* 3. Free Inspection */}
            <div className="border-t border-slate-200/80 pt-2.5 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 border border-amber-200 text-amber-700 shadow-xs">
                <Eye className="h-4 w-4" />
              </div>
              <span className="font-bold text-slate-800">
                {t.productPage.trustFeatures.inspection}
              </span>
            </div>
          </div>

          {/* Collapsible Accordions with Colorful Accents (Reference Image 5) */}
          <div className="divide-y divide-line-light border-y border-line-light pt-1">
            {/* 1. Description Accordion */}
            <div className="py-3.5">
              <button
                type="button"
                onClick={() => toggleSection("description")}
                className="flex w-full items-center justify-between text-left font-bold text-sm text-obsidian hover:text-red-600 transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-600" />
                  <span>{t.productPage.accordions.descriptionTitle}</span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-stone-500 transition-transform duration-200 ${
                    openSections.description ? "rotate-180" : ""
                  }`}
                />
              </button>

              <AnimatePresence initial={false}>
                {openSections.description && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden text-xs text-graphite space-y-3 pt-3"
                  >
                    <p className="leading-relaxed">{localizedDesc}</p>
                    <div className="pt-2">
                      <span className="font-bold text-obsidian block mb-2">
                        {t.productPage.accordions.featuresTitle}:
                      </span>
                      <ul className="space-y-2 text-charcoal">
                        {t.productPage.accordions.featuresList.map((f, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 2. Shipping & Inspection Accordion */}
            <div className="py-3.5">
              <button
                type="button"
                onClick={() => toggleSection("shipping")}
                className="flex w-full items-center justify-between text-left font-bold text-sm text-obsidian hover:text-emerald-600 transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  <span>{t.productPage.accordions.shippingTitle}</span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-stone-500 transition-transform duration-200 ${
                    openSections.shipping ? "rotate-180" : ""
                  }`}
                />
              </button>

              <AnimatePresence initial={false}>
                {openSections.shipping && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden text-xs text-graphite pt-3 leading-relaxed"
                  >
                    <p>{t.productPage.accordions.shippingBody}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 3. Returns & Exchange Accordion */}
            <div className="py-3.5">
              <button
                type="button"
                onClick={() => toggleSection("returns")}
                className="flex w-full items-center justify-between text-left font-bold text-sm text-obsidian hover:text-blue-600 transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  <span>{t.productPage.accordions.returnsTitle}</span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-stone-500 transition-transform duration-200 ${
                    openSections.returns ? "rotate-180" : ""
                  }`}
                />
              </button>

              <AnimatePresence initial={false}>
                {openSections.returns && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden text-xs text-graphite pt-3 leading-relaxed"
                  >
                    <p>{t.productPage.accordions.returnsBody}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Share & Size Guide Footer Links */}
          <div className="flex items-center justify-between pt-2 text-xs font-semibold text-graphite">
            <button
              type="button"
              onClick={() => setShowSizeGuide(true)}
              className="inline-flex items-center gap-1.5 text-obsidian hover:text-black transition cursor-pointer"
            >
              <Ruler className="h-4 w-4 text-obsidian" />
              <span>{t.productPage.sizeGuideBtn}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 text-obsidian hover:text-blue-600 transition cursor-pointer"
            >
              <Share2 className="h-4 w-4 text-blue-600" />
              <span>{copiedLink ? t.productPage.shareCopied : t.productPage.shareBtn}</span>
            </button>
          </div>
        </div>

        {/* Right Column on Desktop (order-1 on mobile, order-2 on lg): Interactive Image Gallery (Reference Image 4) */}
        <div className="lg:col-span-7 order-1 lg:order-2">
          <div className="sticky top-20">
            {/* Primary Big Image Frame */}
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-charcoal/5 border border-line-light shadow-sm">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentMainSrc || "default-img"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="relative h-full w-full"
                >
                  <Image
                    src={currentMainSrc}
                    alt={shots[activeImageIndex]?.alt || localizedName}
                    fill
                    sizes="(min-width: 1024px) 55vw, 100vw"
                    priority
                    unoptimized={currentMainSrc.startsWith("data:")}
                    className="object-cover"
                  />
                </motion.div>
              </AnimatePresence>

              {/* Status Badge on Top */}
              <div className="absolute top-3 left-3 pointer-events-none z-10">
                <StatusLabel className={`${isSoldOut ? "bg-stone-900/90 text-red-300 border-red-500/40" : "bg-obsidian/90 text-amber-300 border-amber-400/40"} text-[11px] font-bold backdrop-blur-md px-3 py-1 rounded-full shadow-sm`}>
                  {isSoldOut ? "✕ نفذ من المخزن" : `✦ ${localizedStatus}`}
                </StatusLabel>
              </div>

              {/* Navigation Arrows on Main Image */}
              {shots.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevImage}
                    aria-label="Previous Image"
                    className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-obsidian backdrop-blur-md transition hover:bg-white hover:scale-110 shadow-md cursor-pointer z-10"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={nextImage}
                    aria-label="Next Image"
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-obsidian backdrop-blur-md transition hover:bg-white hover:scale-110 shadow-md cursor-pointer z-10"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}

              {/* Image Counter Badge on Bottom-Left */}
              {shots.length > 1 && (
                <div className="absolute bottom-3 left-3 rounded-full bg-obsidian/85 border border-white/20 px-3 py-1 text-[11px] font-mono font-bold text-off-white backdrop-blur-md pointer-events-none z-10 shadow">
                  {activeImageIndex + 1} / {shots.length}
                </div>
              )}

              {/* Discount Badge on Bottom-Right (Like Reference Image 2) */}
              {hasDiscount && (
                <span
                  className="absolute bottom-3 right-3 rounded-md px-3 py-1 text-xs sm:text-sm font-black uppercase shadow-lg z-10 pointer-events-none tracking-wider"
                  style={{ backgroundColor: "#c8102e", color: "#ffffff" }}
                >
                  -{discountPercent}%
                </span>
              )}
            </div>

            {/* Horizontal Thumbnails Row */}
            {shots.length > 1 && (
              <div className="relative mt-3.5 flex items-center">
                <button
                  type="button"
                  onClick={() => scrollThumbnails("left")}
                  className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-light bg-white text-obsidian hover:bg-stone-100 transition mr-1.5 cursor-pointer shadow-xs"
                  aria-label="Scroll thumbnails left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div
                  ref={thumbnailsRef}
                  className="flex flex-1 gap-3 overflow-x-auto pb-1.5 scrollbar-none snap-x"
                >
                  {shots.map((shot: any, idx: number) => {
                    const isSelected = idx === activeImageIndex;
                    return (
                      <button
                        key={shot.src}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`relative h-20 w-16 sm:h-24 sm:w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all cursor-pointer snap-start ${
                          isSelected
                            ? "border-stone-900 ring-2 ring-stone-900/25 shadow-md scale-102"
                            : "border-line-light/80 opacity-75 hover:opacity-100 hover:border-graphite bg-stone-100"
                        }`}
                      >
                        <Image
                          src={shot.src}
                          alt=""
                          fill
                          sizes="80px"
                          unoptimized={shot.src.startsWith("data:")}
                          className="object-cover"
                        />
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => scrollThumbnails("right")}
                  className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-light bg-white text-obsidian hover:bg-stone-100 transition ml-1.5 cursor-pointer shadow-xs"
                  aria-label="Scroll thumbnails right"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. "تحب تشوف حاجة تانية ؟" (Related Products Section - Reference Image 4) */}
      {relatedProducts.length > 0 && (
        <section className="mt-20 border-t border-line-light pt-12 sm:pt-16">
          <div className="text-center max-w-xl mx-auto mb-8 sm:mb-10">
            <span className="inline-block rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-extrabold px-3 py-1 mb-2">
              {locale === "ar" ? "تشكيلة مختارة" : "Curated Selection"}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-obsidian tracking-tight">
              {t.productPage.relatedHeading}
            </h2>
            <p className="text-xs sm:text-sm text-graphite mt-1.5">
              {t.productPage.relatedSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {relatedProducts.slice(0, 4).map((rel) => {
              const relImg = resolveImage(rel.images[0]);
              const relName =
                locale === "ar" && t.products[rel.slug]?.name
                  ? t.products[rel.slug].name
                  : rel.name;

              const relHasDiscount = !!rel.originalPrice && rel.originalPrice > rel.price;
              const relDiscountPercent = relHasDiscount
                ? Math.round(((rel.originalPrice! - rel.price) / rel.originalPrice!) * 100)
                : 0;

              return (
                <Link
                  key={rel.slug}
                  href={rel.href}
                  className="group block rounded-2xl overflow-hidden bg-white border border-stone-200/80 hover:border-red-500 hover:shadow-xl transition-all duration-300"
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-charcoal">
                    <Image
                      src={relImg.src}
                      alt={relImg.alt}
                      fill
                      sizes="(min-width: 768px) 25vw, 50vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {relHasDiscount && (
                      <span
                        className="absolute bottom-2.5 right-2.5 rounded-lg px-2.5 py-1 text-xs font-black uppercase shadow-md z-10 tracking-wider"
                        style={{ backgroundColor: "#c8102e", color: "#ffffff" }}
                      >
                        -{relDiscountPercent}%
                      </span>
                    )}
                  </div>
                  <div className="p-3.5 space-y-1">
                    <h3 className="text-xs sm:text-sm font-bold text-obsidian truncate group-hover:underline transition-colors">
                      {relName}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
                      <span
                        className="font-mono text-sm sm:text-base font-black"
                        style={{ color: "#c8102e" }}
                      >
                        {formatPrice(rel.price)}
                      </span>
                      {relHasDiscount && (
                        <span
                          className="text-xs font-mono line-through font-semibold"
                          style={{ color: "#78716c" }}
                        >
                          {formatPrice(rel.originalPrice!)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Sticky Bottom Buy Bar on Mobile (Reference Image 4) */}
      <AnimatePresence>
        {showStickyBar && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-line-light p-3 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-lg bg-charcoal border border-line-light">
                  <Image
                    src={shots[0]?.src || ""}
                    alt=""
                    fill
                    sizes="48px"
                    unoptimized={(shots[0]?.src || "").startsWith("data:")}
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-obsidian truncate">{localizedName}</h4>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span
                      className="font-mono text-xs sm:text-sm font-black"
                      style={{ color: "#c8102e" }}
                    >
                      {formatPrice(currentPrice)}
                    </span>
                    {hasDiscount && (
                      <span
                        className="text-[10px] font-mono line-through font-semibold"
                        style={{ color: "#78716c" }}
                      >
                        {formatPrice(currentOriginalPrice!)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {isSoldOut ? (
                <a
                  href={`https://wa.me/201285694670?text=${encodeURIComponent(
                    `مرحباً TERRA HOP، أود الاستفسار عن موعد توفر هودي "${localizedName}".`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-xl px-4 py-2 text-xs font-bold bg-stone-900 hover:bg-black text-white shadow-md transition"
                >
                  نفذ - راسلنا واتساب
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedSize) {
                      window.scrollTo({ top: 300, behavior: "smooth" });
                      setActionStatus("error");
                    } else {
                      handleBuyNow();
                    }
                  }}
                  className="shrink-0 rounded-xl px-5 py-2.5 text-xs font-black shadow-md shadow-red-600/30 cursor-pointer active:scale-95 transition"
                  style={{ backgroundColor: "#c8102e", color: "#ffffff" }}
                >
                  {t.productPage.stickyBuyNow}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Size Guide Modal */}
      <AnimatePresence>
        {showSizeGuide && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overscroll-contain"
            onClick={() => setShowSizeGuide(false)}
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border-2 border-stone-200 text-obsidian"
              style={{ backgroundColor: "#ffffff", opacity: 1 }}
            >
              <button
                type="button"
                onClick={() => setShowSizeGuide(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-stone-500 hover:text-black hover:bg-stone-100 transition cursor-pointer"
                aria-label="Close Size Guide"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl font-bold"
                  style={{ backgroundColor: "#fee2e2", color: "#dc2626" }}
                >
                  <Ruler className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-black text-obsidian">
                  {t.productPage.sizeGuideTitle}
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-stone-600 mb-5 leading-relaxed font-medium">
                {t.productPage.sizeGuideDesc}
              </p>

              <div
                className="overflow-hidden rounded-xl border border-stone-300 shadow-xs"
                style={{ backgroundColor: "#ffffff" }}
              >
                <table className="w-full text-center text-xs sm:text-sm">
                  <thead className="bg-stone-900 text-white font-bold">
                    <tr>
                      <th className="p-3">المقاس (Size)</th>
                      <th className="p-3">عرض الصدر</th>
                      <th className="p-3">الطول</th>
                      <th className="p-3">الوزن التقريبي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 text-stone-800 font-semibold bg-white" style={{ backgroundColor: "#ffffff" }}>
                    <tr className="hover:bg-red-50/50 bg-white">
                      <td className="p-3 font-black text-sm" style={{ color: "#dc2626" }}>S</td>
                      <td className="p-3 font-mono">56 cm</td>
                      <td className="p-3 font-mono">72 cm</td>
                      <td className="p-3 font-mono">55 - 68 kg</td>
                    </tr>
                    <tr className="hover:bg-red-50/50 bg-stone-50">
                      <td className="p-3 font-black text-sm" style={{ color: "#dc2626" }}>M</td>
                      <td className="p-3 font-mono">59 cm</td>
                      <td className="p-3 font-mono">74 cm</td>
                      <td className="p-3 font-mono">68 - 80 kg</td>
                    </tr>
                    <tr className="hover:bg-red-50/50 bg-white">
                      <td className="p-3 font-black text-sm" style={{ color: "#dc2626" }}>L</td>
                      <td className="p-3 font-mono">62 cm</td>
                      <td className="p-3 font-mono">76 cm</td>
                      <td className="p-3 font-mono">80 - 92 kg</td>
                    </tr>
                    <tr className="hover:bg-red-50/50 bg-stone-50">
                      <td className="p-3 font-black text-sm" style={{ color: "#dc2626" }}>XL</td>
                      <td className="p-3 font-mono">65 cm</td>
                      <td className="p-3 font-mono">78 cm</td>
                      <td className="p-3 font-mono">92 - 105 kg</td>
                    </tr>
                    <tr className="hover:bg-red-50/50 bg-white">
                      <td className="p-3 font-black text-sm" style={{ color: "#dc2626" }}>XXL</td>
                      <td className="p-3 font-mono">68 cm</td>
                      <td className="p-3 font-mono">80 cm</td>
                      <td className="p-3 font-mono">105 - 120 kg</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSizeGuide(false)}
                  className="rounded-xl border-2 px-6 py-2.5 text-xs font-black transition cursor-pointer shadow-md active:scale-95"
                  style={{ backgroundColor: "#dc2626", borderColor: "#dc2626", color: "#ffffff" }}
                >
                  {locale === "ar" ? "فهمت، إغلاق" : "Got it, Close"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
