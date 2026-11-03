"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale-context";

type Strings = { sizeLabel?: string; sizeError?: string; add?: string; added?: string; viewCart?: string };
type Props = { slug: string; sizes: readonly string[]; strings?: Strings; cartHref: string };

export function AddToCart({ slug, sizes, cartHref }: Props) {
  const safeSizes = Array.isArray(sizes) ? sizes : [];
  const { add } = useCart();
  const { locale } = useLocale();
  const [size, setSize] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "error" | "added">("idle");

  const labels = {
    sizeLabel: locale === "ar" ? "اختر المقاس" : "Select Size",
    sizeError: locale === "ar" ? "يرجى اختيار المقاس أولاً لإتمام طلبك" : "Please select a size first to proceed",
    add: locale === "ar" ? "أضف إلى السلة" : "Add to Cart",
    added: locale === "ar" ? "تمت الإضافة بنجاح!" : "Added successfully!",
    viewCart: locale === "ar" ? "عرض السلة وإتمام الطلب" : "View Cart & Checkout",
  };

  function onAdd() {
    if (!size) return setStatus("error");
    add(slug, size);
    setStatus("added");
  }

  return (
    <div>
      <p id={`${slug}-size`} className="text-label text-graphite font-bold">
        {labels.sizeLabel}
      </p>
      <div role="group" aria-labelledby={`${slug}-size`} className="mt-2.5 flex flex-wrap gap-2">
        {safeSizes.map((s) => {
          const selected = s === size;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setSize(s);
                setStatus("idle");
              }}
              className={`h-11 min-w-14 rounded-lg border text-sm font-bold transition-all duration-150 cursor-pointer ${
                selected ? "scale-102 shadow-sm" : "hover:border-stone-400 shadow-2xs"
              }`}
              style={{
                borderColor: selected ? "#080808" : "#d6d3d1",
                backgroundColor: selected ? "#080808" : "#ffffff",
                color: selected ? "#ffffff" : "#080808",
              }}
            >
              {s}
            </button>
          );
        })}
      </div>
      <div aria-live="polite" className="min-h-10 mt-2">
        {status === "error" && (
          <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold shadow-xs">
            <svg
              className="h-4 w-4 shrink-0 text-red-600"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-red-600 font-bold">{labels.sizeError}</span>
          </div>
        )}
      </div>
      <Button onClick={onAdd} className="w-full sm:w-auto sm:min-w-56 cursor-pointer">
        {labels.add}
      </Button>
      <div role="status" className="min-h-10 mt-3">
        {status === "added" && (
          <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold shadow-xs">
            <svg
              className="h-4 w-4 shrink-0 text-emerald-600"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-emerald-700 font-bold">
              {labels.added}{" "}
              <Link href={cartHref} className="font-bold underline underline-offset-4 text-emerald-900 hover:text-emerald-950 ml-1">
                {labels.viewCart}
              </Link>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
