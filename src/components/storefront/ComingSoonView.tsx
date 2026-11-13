"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocale } from "@/lib/locale-context";

interface ComingSoonViewProps {
  targetDate?: string;
  title?: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  caption?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

function calculateTimeLeft(targetIso: string): TimeLeft {
  const target = new Date(targetIso).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0 || isNaN(diff)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    isExpired: false,
  };
}

function padZero(num: number): string {
  return String(num).padStart(2, "0");
}

export function ComingSoonView({
  targetDate = "2026-11-20T00:00:00",
  title,
  imageUrl = "/coming-soon.jpg",
  mobileImageUrl = "/coming-soon-mobile.jpg",
  caption,
}: ComingSoonViewProps) {
  const { locale } = useLocale();
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(targetDate));

  useEffect(() => {
    setTimeLeft(calculateTimeLeft(targetDate));
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const activeDesktopImage = imageUrl || "/coming-soon.jpg";
  const activeMobileImage = mobileImageUrl || "/coming-soon-mobile.jpg";

  return (
    <section className="relative min-h-screen w-full flex flex-col items-center justify-between bg-[#040404] text-off-white overflow-hidden pb-8 sm:pb-12 select-none">
      {/* 1. Atmospheric Ambient Backdrop: Fills screens with misty cinematic blur so there are zero empty voids */}
      <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <picture>
          <source media="(max-width: 639px)" srcSet={activeMobileImage} />
          <source media="(min-width: 640px)" srcSet={activeDesktopImage} />
          <img
            src={activeDesktopImage}
            alt=""
            aria-hidden="true"
            fetchPriority="low"
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover scale-125 blur-3xl opacity-35 md:opacity-45 brightness-75 contrast-125 transform-gpu"
          />
        </picture>
        {/* Deep dark gradient overlay on top & sides */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#040404]/90 via-[#040404]/60 to-[#040404]" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, rgba(255, 255, 255, 0.08) 0%, rgba(5, 5, 5, 0.6) 55%, #040404 85%)",
          }}
        />
      </div>

      {/* 2. Main Hero Poster Stage: Responsive (Portrait on Mobile, Widescreen on Desktop) */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full my-auto pt-2 sm:pt-6">
        {/* Semantic SEO Heading for Google Search Indexing (Matches "تيرا هوب" and "TERRA HOP") */}
        <h1 className="sr-only">TERRA HOP | تيرا هوب - براند ستريت وير مصري</h1>
        <p className="sr-only">
          موقع تيرا هوب (TERRA HOP) الرسمي - براند مصري للأزياء والستريت وير الأوفر سايز للشباب في مصر. هوديز وتيشيرتات بتصاميم عصرية وخامات فاخرة بحجز مسبق.
        </p>

        {/* The Responsive Poster Stage */}
        <div className="relative w-full flex flex-col items-center justify-center px-3 sm:px-6">
          {/* Mobile Vertical Poster (< sm): Fills phone viewport elegantly like the original poster */}
          <div className="block sm:hidden relative w-full max-w-[340px] xs:max-w-[360px] aspect-[768/1376] rounded-xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.95)] border border-white/10 group bg-black/95">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeMobileImage}
              alt={title || "TERRA HOP | تيرا هوب - براند ستريت وير مصري قريباً"}
              width={768}
              height={1376}
              fetchPriority="high"
              loading="eager"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.01]"
            />
          </div>

          {/* Desktop Cinematic Banner (>= sm): Widescreen cinematic spectacle */}
          <div className="hidden sm:block relative w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl aspect-[1024/434] rounded-2xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.95)] border border-white/10 group bg-black/95">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeDesktopImage}
              alt={title || "TERRA HOP | تيرا هوب - براند ستريت وير مصري قريباً"}
              width={1024}
              height={434}
              fetchPriority="high"
              loading="eager"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.01]"
            />
          </div>

          {/* Optional Admin-Defined Caption */}
          {caption ? (
            <div className="mt-3.5 sm:mt-4 text-center px-4 max-w-2xl">
              <p className="text-xs sm:text-sm md:text-base font-medium text-concrete/90 tracking-wide leading-relaxed">
                {caption}
              </p>
            </div>
          ) : null}
        </div>

        {/* 3. Live Countdown Dock */}
        <div className="w-full max-w-lg mt-4 sm:mt-7 px-4">
          <div className="relative overflow-hidden bg-black/75 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl">
            {/* Top Tagline */}
            <div className="flex items-center justify-center mb-3.5 text-center">
              <span className="font-mono text-[11px] sm:text-xs uppercase tracking-widest text-concrete/90 font-semibold">
                {locale === "ar" ? "العد التنازلي لموعد الإطلاق الرسمي" : "OFFICIAL DROP LAUNCH COUNTDOWN"}
              </span>
            </div>

            {/* Timer Grid */}
            <div className="grid grid-cols-4 gap-2 sm:gap-3 text-center">
              {/* Days */}
              <div className="flex flex-col items-center justify-center bg-white/[0.04] border border-white/5 rounded-xl py-2.5 sm:py-3 px-1">
                <span
                  suppressHydrationWarning
                  className="font-mono text-2xl sm:text-4xl md:text-5xl font-extrabold text-off-white tracking-wider tabular-nums"
                >
                  {padZero(timeLeft.days)}
                </span>
                <span className="text-[10px] sm:text-xs text-concrete uppercase tracking-widest mt-1 font-semibold">
                  {locale === "ar" ? "يوم" : "DAYS"}
                </span>
              </div>

              {/* Hours */}
              <div className="flex flex-col items-center justify-center bg-white/[0.04] border border-white/5 rounded-xl py-2.5 sm:py-3 px-1">
                <span
                  suppressHydrationWarning
                  className="font-mono text-2xl sm:text-4xl md:text-5xl font-extrabold text-off-white tracking-wider tabular-nums"
                >
                  {padZero(timeLeft.hours)}
                </span>
                <span className="text-[10px] sm:text-xs text-concrete uppercase tracking-widest mt-1 font-semibold">
                  {locale === "ar" ? "ساعة" : "HRS"}
                </span>
              </div>

              {/* Minutes */}
              <div className="flex flex-col items-center justify-center bg-white/[0.04] border border-white/5 rounded-xl py-2.5 sm:py-3 px-1">
                <span
                  suppressHydrationWarning
                  className="font-mono text-2xl sm:text-4xl md:text-5xl font-extrabold text-off-white tracking-wider tabular-nums"
                >
                  {padZero(timeLeft.minutes)}
                </span>
                <span className="text-[10px] sm:text-xs text-concrete uppercase tracking-widest mt-1 font-semibold">
                  {locale === "ar" ? "دقيقة" : "MINS"}
                </span>
              </div>

              {/* Seconds */}
              <div className="flex flex-col items-center justify-center bg-white/[0.04] border border-white/5 rounded-xl py-2.5 sm:py-3 px-1">
                <span
                  suppressHydrationWarning
                  className="font-mono text-2xl sm:text-4xl md:text-5xl font-extrabold text-off-white tracking-wider tabular-nums text-white"
                >
                  {padZero(timeLeft.seconds)}
                </span>
                <span className="text-[10px] sm:text-xs text-concrete uppercase tracking-widest mt-1 font-semibold">
                  {locale === "ar" ? "ثانية" : "SECS"}
                </span>
              </div>
            </div>

            {timeLeft.isExpired && (
              <p className="mt-3.5 text-center font-mono text-xs sm:text-sm text-off-white font-bold tracking-widest bg-white/10 py-2 rounded-lg">
                {locale === "ar" ? "🔥 حان موعد الإطلاق الرسمي · The Drop is Live" : "🔥 THE DROP IS LIVE NOW"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 4. Scroll Down Invitation to Footer */}
      <footer className="relative z-10 w-full flex flex-col items-center justify-center pt-6 text-concrete/70">
        <div className="flex flex-col items-center gap-1.5 cursor-pointer opacity-80 hover:opacity-100 transition-opacity">
          <span className="font-mono text-[11px] sm:text-xs tracking-wider">
            {locale === "ar" ? "مرر للأسفل لمعلومات المتجر والتواصل" : "SCROLL DOWN FOR STORE INFO & CONTACT"}
          </span>
          <ChevronDown className="w-4 h-4 animate-bounce text-off-white" />
        </div>
      </footer>
    </section>
  );
}
