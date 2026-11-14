"use client";

import React, { useEffect, useState, useRef } from "react";

interface FlipCardProps {
  label: string;
  subLabel?: string;
  value: number;
}

function padTwo(n: number): string {
  return String(Math.max(0, n)).padStart(2, "0");
}

export function FlipCard({ label, subLabel, value }: FlipCardProps) {
  const formatted = padTwo(value);
  const [currentValue, setCurrentValue] = useState(formatted);
  const [previousValue, setPreviousValue] = useState(formatted);
  const [isFlipping, setIsFlipping] = useState(false);
  const prevValRef = useRef(formatted);

  useEffect(() => {
    if (formatted !== prevValRef.current) {
      setPreviousValue(prevValRef.current);
      setCurrentValue(formatted);
      setIsFlipping(true);
      prevValRef.current = formatted;

      const timer = setTimeout(() => {
        setIsFlipping(false);
      }, 550);

      return () => clearTimeout(timer);
    }
  }, [formatted]);

  return (
    <div className="flex flex-col items-center">
      {/* 1. Header Label (DAYS / HOURS / MINUTES / SECONDS) matching Split-Flap Clock */}
      <div className="flex flex-col items-center mb-2 sm:mb-2.5 select-none">
        <span className="font-sans text-[11px] sm:text-xs md:text-sm uppercase font-bold tracking-[0.2em] text-neutral-300 drop-shadow-xs">
          {label}
        </span>
        {subLabel && (
          <span className="text-[9px] sm:text-[10px] text-neutral-400 font-medium tracking-normal mt-0.5">
            {subLabel}
          </span>
        )}
      </div>

      {/* 2. Main Mechanical Flip Card Body */}
      <div
        className="relative w-[70px] h-[86px] xs:w-[78px] xs:h-[96px] sm:w-[96px] sm:h-[116px] md:w-[114px] md:h-[136px] lg:w-[126px] lg:h-[150px] rounded-md sm:rounded-lg md:rounded-xl bg-[#141416] shadow-[0_16px_36px_rgba(0,0,0,0.85),0_2px_8px_rgba(0,0,0,0.6)] border border-white/10 select-none overflow-hidden flex flex-col"
        style={{ perspective: "1000px" }}
      >
        {/* ================= STATIC UNDERLAYER ================= */}
        {/* Upper Static Flap (shows new currentValue) */}
        <div className="relative w-full h-1/2 overflow-hidden bg-gradient-to-b from-[#2A2A2D] to-[#1C1C1E] border-b border-black/90 flex items-end justify-center">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <span
            suppressHydrationWarning
            className="font-sans font-extrabold text-[42px] xs:text-[48px] sm:text-[62px] md:text-[76px] lg:text-[88px] text-neutral-100 tracking-tight leading-none translate-y-1/2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tabular-nums"
          >
            {currentValue}
          </span>
        </div>

        {/* Lower Static Flap (shows new currentValue) */}
        <div className="relative w-full h-1/2 overflow-hidden bg-gradient-to-b from-[#131315] via-[#1B1B1D] to-[#161618] flex items-start justify-center shadow-[inset_0_4px_8px_rgba(0,0,0,0.7)]">
          <span
            suppressHydrationWarning
            className="font-sans font-extrabold text-[42px] xs:text-[48px] sm:text-[62px] md:text-[76px] lg:text-[88px] text-neutral-200 tracking-tight leading-none -translate-y-1/2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tabular-nums"
          >
            {currentValue}
          </span>
        </div>

        {/* ================= ANIMATED LEAF OVERLAYS ================= */}
        {isFlipping && (
          <>
            {/* Top Leaf: flips down from 0 to -90deg */}
            <div
              className="absolute inset-x-0 top-0 h-1/2 overflow-hidden bg-gradient-to-b from-[#2A2A2D] to-[#1C1C1E] border-b border-black/90 flex items-end justify-center z-30 flip-leaf-top"
              style={{ transformOrigin: "bottom" }}
            >
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <span
                suppressHydrationWarning
                className="font-sans font-extrabold text-[42px] xs:text-[48px] sm:text-[62px] md:text-[76px] lg:text-[88px] text-neutral-100 tracking-tight leading-none translate-y-1/2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tabular-nums"
              >
                {previousValue}
              </span>
            </div>

            {/* Bottom Leaf: unfolds from 90deg to 0deg */}
            <div
              className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden bg-gradient-to-b from-[#131315] via-[#1B1B1D] to-[#161618] flex items-start justify-center z-30 shadow-[inset_0_4px_8px_rgba(0,0,0,0.7)] flip-leaf-bottom"
              style={{ transformOrigin: "top" }}
            >
              <span
                suppressHydrationWarning
                className="font-sans font-extrabold text-[42px] xs:text-[48px] sm:text-[62px] md:text-[76px] lg:text-[88px] text-neutral-200 tracking-tight leading-none -translate-y-1/2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tabular-nums"
              >
                {currentValue}
              </span>
            </div>
          </>
        )}

        {/* ================= CENTER HORIZONTAL SEAM ================= */}
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-[1.5px] sm:h-[2px] bg-black z-40 shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />

        {/* ================= LEFT HINGE TAB ================= */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[1px] w-[3px] sm:w-[4px] h-[8px] sm:h-[11px] bg-gradient-to-r from-neutral-400 to-neutral-200 rounded-[1px] shadow-sm z-50 border-[0.5px] border-black/50" />

        {/* ================= RIGHT HINGE TAB ================= */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[1px] w-[3px] sm:w-[4px] h-[8px] sm:h-[11px] bg-gradient-to-l from-neutral-400 to-neutral-200 rounded-[1px] shadow-sm z-50 border-[0.5px] border-black/50" />
      </div>
    </div>
  );
}
