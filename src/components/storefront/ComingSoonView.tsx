"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { FlipCard } from "@/components/storefront/FlipCard";
import { InteractiveComingSoonPoster } from "@/components/storefront/InteractiveComingSoonPoster";
import { ThreeLogoScene } from "@/components/storefront/ThreeLogoScene";

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
    minutes: Math.floor((diff % (1000 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    isExpired: false,
  };
}

export function ComingSoonView({
  targetDate = "2026-11-20T00:00:00",
  title,
  imageUrl,
  mobileImageUrl,
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

  // Use Image #2 for desktop with version cache-buster
  const activeDesktopImage =
    imageUrl && imageUrl !== "/coming-soon.jpg" && imageUrl !== "/coming-soon-desktop.jpg"
      ? imageUrl
      : "/coming-soon-desktop.jpg?v=20261114-5";

  // Use tall mobile version with version cache-buster
  const activeMobileImage =
    mobileImageUrl && mobileImageUrl !== "/coming-soon-mobile.jpg"
      ? mobileImageUrl
      : "/coming-soon-mobile.jpg?v=20261114-5";

  return (
    <section className="relative min-h-screen w-full flex flex-col items-center justify-between bg-[#0A0A0C] text-off-white overflow-hidden pb-8 sm:pb-14 select-none">
      {/* 1. Atmospheric Ambient Backdrop */}
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

      {/* 2. Top Header with Three.js Animated 3D Logo */}
      <header className="relative z-20 w-full flex flex-col items-center justify-center pt-5 pb-3 sm:pt-6 sm:pb-4">
        <Link
          href="/"
          className="group flex flex-col items-center gap-1.5 focus:outline-hidden"
          aria-label="TERRA HOP Home"
        >
          {/* Three.js Interactive 3D Orbiting Logo Emblem */}
          <div className="relative flex items-center justify-center drop-shadow-[0_8px_24px_rgba(0,0,0,0.85)]">
            <ThreeLogoScene size={84} />
          </div>

          <div className="flex flex-col items-center -mt-1">
            <span className="font-display font-black text-sm sm:text-base md:text-lg tracking-[0.38em] text-off-white uppercase">
              TERRA HOP
            </span>
            <span className="font-mono text-[8.5px] sm:text-[9.5px] tracking-[0.28em] text-concrete/70 uppercase">
              {locale === "ar" ? "براند مصري للأزياء والهوديز الأوفر سايز" : "EGYPTIAN OVERSIZED FASHION & HOODIES"}
            </span>
          </div>
        </Link>
      </header>

      {/* 3. Main Hero Poster Stage */}
      <div className="relative z-10 flex flex-col items-center justify-start w-full pt-0">
        {/* Semantic SEO Heading for Google Search Indexing */}
        <h1 className="sr-only">TERRA HOP | تيرا هوب - براند مصري للأزياء والهوديز الأوفر سايز</h1>
        <p className="sr-only">
          موقع تيرا هوب (TERRA HOP) الرسمي - براند مصري للأزياء والهوديز الأوفر سايز والتيشرتات للشباب في مصر. تشكيلات هوديز وتيشيرتات عصرية بخامات قطن فاخرة. تسوق أونلاين: تيراهوب، تيرا هوب، تيرهوب، TERRAHOP، TERA HOP، هودي TERRA HOP، ملابس شتوي وتيشيرتات أوفر سايز.
        </p>

        {/* Interactive 3D Tilt, Metallic Light Sheen & Bouncing Letters Poster */}
        <InteractiveComingSoonPoster
          desktopImage={activeDesktopImage}
          mobileImage={activeMobileImage}
          title={title}
        />

        {/* Optional Admin-Defined Caption */}
        {caption ? (
          <div className="mt-5 sm:mt-6 text-center px-4 max-w-2xl">
            <p className="text-xs sm:text-sm md:text-base font-medium text-concrete/90 tracking-wide leading-relaxed">
              {caption}
            </p>
          </div>
        ) : null}

        {/* =========================================================================
            4. LIVE COUNTDOWN DOCK:
            Pushed down into the lower area (as requested with the blue arrow)
            with balanced spacing above the footer logo.
           ========================================================================= */}
        <div className="w-full max-w-3xl mt-8 sm:mt-12 md:mt-14 px-3 flex flex-col items-center">
          {/* Top Tagline */}
          <div className="flex items-center justify-center mb-3 sm:mb-4 text-center">
            <span className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.25em] text-neutral-400 font-semibold bg-white/[0.04] px-4 py-1.5 rounded-full border border-white/10 shadow-xs">
              {locale === "ar" ? "العد التنازلي لموعد الإطلاق الرسمي" : "OFFICIAL DROP LAUNCH COUNTDOWN"}
            </span>
          </div>

          {/* Mechanical Split-Flap Flip Cards Grid (DAYS - HOURS - MINUTES - SECONDS) */}
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
            <p className="mt-5 text-center font-mono text-xs sm:text-sm text-off-white font-bold tracking-widest bg-white/10 py-2.5 px-6 rounded-xl border border-white/10 shadow-lg">
              {locale === "ar" ? "🔥 حان موعد الإطلاق الرسمي · The Drop is Live" : "🔥 THE DROP IS LIVE NOW"}
            </p>
          )}
        </div>
      </div>

      {/* 5. Scroll Down Invitation to Footer */}
      <footer className="relative z-10 w-full flex flex-col items-center justify-center pt-8 sm:pt-10 text-concrete/70">
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
