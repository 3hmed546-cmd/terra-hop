"use client";

import React from "react";
import { useLocale } from "@/lib/locale-context";

type OffersTickerProps = {
  ticker?: {
    items: readonly string[];
  };
};

const HIGHLIGHT_PHRASES = [
  "شحن مجاني",
  "حصرية محدودة",
  "شحن سريع",
  "عند الاستلام",
  "FREE SHIPPING",
  "LIMITED QUANTITIES",
  "FAST SHIPPING",
  "CASH ON DELIVERY",
  "ON DELIVERY",
];

// Helper to highlight targeted phrases with yellow badge background matching Image 1
function renderHighlightedItem(text: string) {
  if (!text) return null;

  const isArabic = /[\u0600-\u06FF]/.test(text);

  // Build regex matching any of the target phrases
  const regex = new RegExp(`(${HIGHLIGHT_PHRASES.join("|")})`, "g");
  const parts = text.split(regex).filter((p) => p.length > 0);

  if (parts.length <= 1) {
    return (
      <span dir={isArabic ? "rtl" : "ltr"} style={{ unicodeBidi: "isolate" }}>
        {text}
      </span>
    );
  }

  return (
    <span
      dir={isArabic ? "rtl" : "ltr"}
      className="inline-flex items-center"
      style={{ unicodeBidi: "isolate" }}
    >
      {parts.map((part, idx) => {
        if (HIGHLIGHT_PHRASES.includes(part)) {
          return (
            <span
              key={idx}
              className="inline-block bg-[#fee55f] text-[#080808] font-black px-2.5 py-0.5 mx-1.5 rounded-md shadow-xs leading-normal select-none"
            >
              {part}
            </span>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </span>
  );
}

export function OffersTicker({ ticker }: OffersTickerProps) {
  const { t } = useLocale();

  const items = t.ticker && t.ticker.length > 0 ? t.ticker : (ticker?.items ?? []);
  if (!items || items.length === 0) return null;

  // Repeat items in each track so it seamlessly spans any viewport width
  const repeatedItems = [...items, ...items];

  return (
    <div
      dir="ltr"
      aria-label="Offers and announcements"
      className="relative w-full overflow-hidden select-none py-3.5 md:py-4 bg-transparent text-obsidian border-y border-line-light/60"
    >
      <style>{`
        @keyframes marqueeScroll {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }
        .marquee-content {
          display: flex;
          width: max-content;
          animation: marqueeScroll 52s linear infinite;
          will-change: transform;
        }
        .marquee-content:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-content {
            animation: none !important;
          }
        }
      `}</style>
      <div className="marquee-content">
        {/* Primary track */}
        <div className="flex shrink-0 items-center gap-6 px-6 font-display text-xs sm:text-sm md:text-base font-bold uppercase tracking-wider">
          {repeatedItems.map((item, index) => (
            <span key={`ticker-1-${index}`} className="flex items-center gap-6 shrink-0">
              {renderHighlightedItem(item)}
              <span className="text-obsidian/40 text-xs select-none" aria-hidden="true">
                ✦
              </span>
            </span>
          ))}
        </div>

        {/* Duplicate track for seamless infinite loop */}
        <div
          className="flex shrink-0 items-center gap-6 px-6 font-display text-xs sm:text-sm md:text-base font-bold uppercase tracking-wider"
          aria-hidden="true"
        >
          {repeatedItems.map((item, index) => (
            <span key={`ticker-2-${index}`} className="flex items-center gap-6 shrink-0">
              {renderHighlightedItem(item)}
              <span className="text-obsidian/40 text-xs select-none" aria-hidden="true">
                ✦
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
