"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocale } from "@/lib/locale-context";

interface ComingSoonViewProps {
  targetDate?: string;
  title?: string;
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

export function ComingSoonView({ targetDate = "2026-11-20T00:00:00", title }: ComingSoonViewProps) {
  const { locale } = useLocale();
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(targetDate));

  useEffect(() => {
    setMounted(true);
    setTimeLeft(calculateTimeLeft(targetDate));
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <section className="relative min-h-screen w-full flex flex-col items-center justify-between bg-[#040404] text-off-white overflow-hidden pb-8 sm:pb-12 select-none">
      {/* 1. Atmospheric Ambient Backdrop on Desktop: Fills large screens with misty cinematic blur so there are zero empty voids */}
      <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/coming-soon.jpg"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover scale-125 blur-3xl opacity-35 md:opacity-45 brightness-75 contrast-125 transform-gpu"
        />
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

      {/* 2. Main Hero Poster & Countdown Stage: Full width on mobile, commanding and framed on desktop */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full my-auto pt-0 sm:pt-6">
        {/* Semantic SEO Heading for Google Search Indexing (Matches "تيرا هوب" and "TERRA HOP") */}
        <h1 className="sr-only">TERRA HOP | تيرا هوب - براند ستريت وير مصري</h1>
        <p className="sr-only">
          موقع تيرا هوب (TERRA HOP) الرسمي - براند مصري للأزياء والستريت وير الأوفر سايز للشباب في مصر. هوديز وتيشيرتات بتصاميم عصرية وخامات فاخرة بحجز مسبق.
        </p>

        {/* The Poster Image */}
        <div className="relative w-full sm:w-auto flex justify-center">
          <div className="relative w-full max-w-full sm:max-w-[440px] md:max-w-[500px] lg:max-w-[580px] xl:max-w-[640px] aspect-[764/1024] sm:rounded-2xl overflow-hidden shadow-[0_20px_70px_rgba(0,0,0,0.95)] sm:border sm:border-white/10 group bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/coming-soon.jpg"
              alt={title || "TERRA HOP | تيرا هوب - براند ملابس ستريت وير مصري قريباً"}
              width={764}
              height={1024}
              fetchPriority="high"
              decoding="async"
              className="w-full h-full object-cover sm:object-contain transition-transform duration-1000 ease-out group-hover:scale-[1.01]"
            />
            {/* Edge fade on mobile so it blends seamlessly into the background */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#040404] via-transparent to-transparent sm:hidden opacity-90 h-24 top-auto" />
          </div>
        </div>

        {/* 3. Live Countdown Dock */}
        <div className="w-full max-w-lg mt-4 sm:mt-8 px-4">
          <div className="relative overflow-hidden bg-black/75 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl">
            {/* Top Tagline without any star emojis or icons */}
            <div className="flex items-center justify-center mb-3.5 text-center">
              <span className="font-mono text-[11px] sm:text-xs uppercase tracking-widest text-concrete/90 font-semibold">
                {locale === "ar" ? "العد التنازلي لموعد الإطلاق الرسمي" : "OFFICIAL DROP LAUNCH COUNTDOWN"}
              </span>
            </div>

            {/* Timer Grid */}
            <div className="grid grid-cols-4 gap-2 sm:gap-3 text-center">
              {/* Days */}
              <div className="flex flex-col items-center justify-center bg-white/[0.04] border border-white/5 rounded-xl py-2.5 sm:py-3 px-1">
                <span className="font-mono text-2xl sm:text-4xl md:text-5xl font-extrabold text-off-white tracking-wider tabular-nums">
                  {mounted ? padZero(timeLeft.days) : "00"}
                </span>
                <span className="text-[10px] sm:text-xs text-concrete uppercase tracking-widest mt-1 font-semibold">
                  {locale === "ar" ? "يوم" : "DAYS"}
                </span>
              </div>

              {/* Hours */}
              <div className="flex flex-col items-center justify-center bg-white/[0.04] border border-white/5 rounded-xl py-2.5 sm:py-3 px-1">
                <span className="font-mono text-2xl sm:text-4xl md:text-5xl font-extrabold text-off-white tracking-wider tabular-nums">
                  {mounted ? padZero(timeLeft.hours) : "00"}
                </span>
                <span className="text-[10px] sm:text-xs text-concrete uppercase tracking-widest mt-1 font-semibold">
                  {locale === "ar" ? "ساعة" : "HRS"}
                </span>
              </div>

              {/* Minutes */}
              <div className="flex flex-col items-center justify-center bg-white/[0.04] border border-white/5 rounded-xl py-2.5 sm:py-3 px-1">
                <span className="font-mono text-2xl sm:text-4xl md:text-5xl font-extrabold text-off-white tracking-wider tabular-nums">
                  {mounted ? padZero(timeLeft.minutes) : "00"}
                </span>
                <span className="text-[10px] sm:text-xs text-concrete uppercase tracking-widest mt-1 font-semibold">
                  {locale === "ar" ? "دقيقة" : "MINS"}
                </span>
              </div>

              {/* Seconds */}
              <div className="flex flex-col items-center justify-center bg-white/[0.04] border border-white/5 rounded-xl py-2.5 sm:py-3 px-1">
                <span className="font-mono text-2xl sm:text-4xl md:text-5xl font-extrabold text-off-white tracking-wider tabular-nums text-white">
                  {mounted ? padZero(timeLeft.seconds) : "00"}
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
