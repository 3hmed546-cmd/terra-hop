"use client";

import Image from "next/image";
import Link from "next/link";
import { images } from "@/content/images";
import { formatPrice } from "@/lib/format";
import { StatusLabel } from "@/components/ui/status-label";
import { useLocale } from "@/lib/locale-context";
import { useAdminStore } from "@/lib/admin/store";
import type { Product } from "@/content/home";

// The whole card is one link. The second image fades in on hover only.
export function ProductCard({ product }: { product: Product }) {
  const { locale, t } = useLocale();
  const [first, second] = product.images.map((slot) => images[slot]);
  const sizes = "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw";

  const localizedName =
    locale === "ar" && t.products[product.slug]?.name
      ? t.products[product.slug].name
      : product.name;

  const localizedStatus =
    locale === "ar" ? t.drop.preorderBadge : (product.status ?? "PREORDER");

  const { data: adminData } = useAdminStore();
  const matchedAdmin = adminData?.products.find((p) => p.slug === product.slug || p.id === product.slug);
  const currentPrice = matchedAdmin ? (matchedAdmin.priceCents / 100) : product.price;
  const currentOriginalPrice = matchedAdmin?.compareAtCents ? (matchedAdmin.compareAtCents / 100) : product.originalPrice;

  const hasDiscount = !!currentOriginalPrice && currentOriginalPrice > currentPrice;
  const discountPercent = hasDiscount
    ? Math.round(((currentOriginalPrice! - currentPrice) / currentOriginalPrice!) * 100)
    : 0;

  return (
    <Link href={product.href} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-charcoal">
        <Image
          src={first.src}
          alt={first.alt}
          width={first.width}
          height={first.height}
          sizes={sizes}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <Image
          src={second?.src || first.src}
          alt=""
          width={second?.width || first.width}
          height={second?.height || first.height}
          sizes={sizes}
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        />
        {hasDiscount && (
          <span
            className="absolute bottom-2.5 right-2.5 rounded-lg px-2.5 py-1 text-xs font-black uppercase shadow-md z-10 tracking-wider"
            style={{ backgroundColor: "#c8102e", color: "#ffffff" }}
          >
            -{discountPercent}%
          </span>
        )}
      </div>
      <h3 className="mt-3 text-sm sm:text-base font-bold text-obsidian truncate group-hover:underline">
        {localizedName}
      </h3>
      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <span
          className="font-mono text-base sm:text-lg font-black"
          style={{ color: "#c8102e" }}
        >
          {formatPrice(currentPrice)}
        </span>
        {hasDiscount && (
          <span
            className="font-mono text-xs sm:text-sm line-through font-semibold"
            style={{ color: "#78716c" }}
          >
            {formatPrice(currentOriginalPrice!)}
          </span>
        )}
      </div>
      {product.status && <StatusLabel className="mt-1.5 inline-block text-[10px]">{localizedStatus}</StatusLabel>}
    </Link>
  );
}
