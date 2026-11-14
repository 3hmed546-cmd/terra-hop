"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { FlipCard } from "@/components/storefront/FlipCard";

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
    <section className="relative min-h-screen w-full flex flex-col items-center justify-between bg-[#0A0A0C] text-off-white overflow-hidden pb-8 sm:pb-12 select-none">
      {/* 1. Atmospheric Ambient Backdrop: Subtle dark studio spotlight matching the split-flap countdown backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 32%, rgba(65, 65, 75, 0.35) 0%, rgba(20, 20, 24, 0.75) 50%, #0A0A0C 85%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0C]/90 via-transparent to-[#0A0A0C]" />
      </div>

      {/* 2. Main Hero Poster Stage: Responsive (Portrait on Mobile, Widescreen on Desktop) */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full my-auto pt-2 sm:pt-6">
        {/* Semantic SEO Heading for Google Search Indexing */}
        <h1 className="sr-only">TERRA HOP | تيرا هوب - براند ستريت وير مصري</h1>
        <p className="sr-only">
          موقع تيرا هوب (TERRA HOP) الرسمي - براند مصري للأزياء والستريت وير الأوفر سايز للشباب في مصر. هوديز وتيشيرتات بتصاميم عصرية وخامات فاخرة بحجز مسبق.
        </p>

        {/* The Responsive Poster Stage */}
        <div className="relative w-full flex flex-col items-center justify-center px-3 sm:px-6">
          {/* Mobile Vertical Poster (< sm): 9:16 portrait filling phone viewport elegantly */}
          <div className="block sm:hidden relative w-full max-w-[320px] xs:max-w-[360px] aspect-[576/1024] rounded-2xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.95)] border border-white/10 group bg-black/95">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeMobileImage}
              alt={title || "TERRA HOP | تيرا هوب - براند ستريت وير مصري قريباً"}
              width={576}
              height={1024}
              fetchPriority="high"
              loading="eager"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.01]"
            />
          </div>

          {/* Desktop Cinematic Banner (>= sm): 16:9 widescreen taking the computer screen nicely */}
          <div className="hidden sm:block relative w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl aspect-[16/9] rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.95)] border border-white/10 group bg-black/95">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeDesktopImage}
              alt={title || "TERRA HOP | تيرا هوب - براند ستريت وير مصري قريباً"}
              width={1920}
              height={1080}
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

        {/* 3. Live Countdown Dock: Mechanical Split-Flap Flip Clock Aesthetic matching the reference */}
        <div className="w-full max-w-3xl mt-5 sm:mt-9 px-3 flex flex-col items-center">
          {/* Top Tagline */}
          <div className="flex items-center justify-center mb-3 sm:mb-4 text-center">
            <span className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.25em] text-neutral-400 font-semibold bg-white/[0.04] px-4 py-1.5 rounded-full border border-white/10 shadow-xs">
              {locale === "ar" ? "العد التنازلي لموعد الإطلاق الرسمي" : "OFFICIAL DROP LAUNCH COUNTDOWN"}
            </span>
          </div>

          {/* Mechanical Flip Cards Grid (DAYS - HOURS - MINUTES - SECONDS) */}
          <div className="flex items-center justify-center gap-2 xs:gap-3 sm:gap-4 md:gap-5 lg:gap-6">
            <FlipCard
              label="DAYS"
              subLabel={locale === "ar" ? "أيام" : undefined}
              value={timeLeft.days}
            />
            <FlipCard
              label="HOURS"
              subLabel={locale === "ar" ? "ساعات" : undefined}
              value={timeLeft.hours}
            />
            <FlipCard
              label="MINUTES"
              subLabel={locale === "ar" ? "دقائق" : undefined}
              value={timeLeft.minutes}
            />
            <FlipCard
              label="SECONDS"
              subLabel={locale === "ar" ? "ثواني" : undefined}
              value={timeLeft.seconds}
            />
          </div>

          {timeLeft.isExpired && (
            <p className="mt-4 text-center font-mono text-xs sm:text-sm text-off-white font-bold tracking-widest bg-white/10 py-2.5 px-6 rounded-xl border border-white/10 shadow-lg">
              {locale === "ar" ? "🔥 حان موعد الإطلاق الرسمي · The Drop is Live" : "🔥 THE DROP IS LIVE NOW"}
            </p>
          )}
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
