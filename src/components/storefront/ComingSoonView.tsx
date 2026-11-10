"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/logo";
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
    <section className="relative min-h-screen w-full flex flex-col items-center justify-between bg-[#040404] text-off-white overflow-hidden px-4 pt-8 pb-10 sm:pt-12 sm:pb-14 select-none">
      {/* Ambient background glow & atmospheric vignette */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.07) 0%, rgba(20, 20, 20, 0.4) 45%, transparent 75%)",
        }}
        aria-hidden="true"
      />

      {/* Top Header: Brand Logo */}
      <header className="w-full flex justify-center z-10">
        <Logo className="w-32 sm:w-40 md:w-44 text-off-white opacity-95 transition-opacity hover:opacity-100" />
      </header>

      {/* Center Main Stage: The Exclusive Coming Soon Poster & Countdown Dock */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-4xl my-auto py-6 sm:py-8">
        {/* The Poster Image */}
        <div className="relative w-full max-w-[320px] sm:max-w-[400px] md:max-w-[460px] lg:max-w-[500px] aspect-[764/1024] rounded-2xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] border border-white/10 group bg-obsidian">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/coming-soon.jpg"
            alt={title || "TERRA HOP IS COMING SOON"}
            width={764}
            height={1024}
            fetchPriority="high"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.015]"
          />
          {/* Dark gradient blend on edges */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-70" />
        </div>

        {/* Live Countdown Dock */}
        <div className="w-full max-w-lg mt-8 sm:mt-10 px-2 sm:px-4">
          <div className="relative overflow-hidden bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 shadow-2xl">
            {/* Top Tagline */}
            <div className="flex items-center justify-center gap-2 mb-4 text-center">
              <Sparkles className="w-3.5 h-3.5 text-off-white/80 animate-pulse" />
              <span className="font-mono text-[11px] sm:text-xs uppercase tracking-widest text-concrete font-medium">
                {locale === "ar" ? "العد التنازلي لموعد الإطلاق الرسمي" : "OFFICIAL DROP LAUNCH COUNTDOWN"}
              </span>
              <Sparkles className="w-3.5 h-3.5 text-off-white/80 animate-pulse" />
            </div>

            {/* Timer Grid */}
            <div className="grid grid-cols-4 gap-2 sm:gap-3.5 text-center">
              {/* Days */}
              <div className="flex flex-col items-center justify-center bg-white/[0.04] border border-white/5 rounded-xl py-3 px-1">
                <span className="font-mono text-2xl sm:text-4xl md:text-5xl font-extrabold text-off-white tracking-wider tabular-nums">
                  {mounted ? padZero(timeLeft.days) : "00"}
                </span>
                <span className="text-[10px] sm:text-xs text-concrete uppercase tracking-widest mt-1.5 font-semibold">
                  {locale === "ar" ? "يوم" : "DAYS"}
                </span>
              </div>

              {/* Hours */}
              <div className="flex flex-col items-center justify-center bg-white/[0.04] border border-white/5 rounded-xl py-3 px-1">
                <span className="font-mono text-2xl sm:text-4xl md:text-5xl font-extrabold text-off-white tracking-wider tabular-nums">
                  {mounted ? padZero(timeLeft.hours) : "00"}
                </span>
                <span className="text-[10px] sm:text-xs text-concrete uppercase tracking-widest mt-1.5 font-semibold">
                  {locale === "ar" ? "ساعة" : "HRS"}
                </span>
              </div>

              {/* Minutes */}
              <div className="flex flex-col items-center justify-center bg-white/[0.04] border border-white/5 rounded-xl py-3 px-1">
                <span className="font-mono text-2xl sm:text-4xl md:text-5xl font-extrabold text-off-white tracking-wider tabular-nums">
                  {mounted ? padZero(timeLeft.minutes) : "00"}
                </span>
                <span className="text-[10px] sm:text-xs text-concrete uppercase tracking-widest mt-1.5 font-semibold">
                  {locale === "ar" ? "دقيقة" : "MINS"}
                </span>
              </div>

              {/* Seconds */}
              <div className="flex flex-col items-center justify-center bg-white/[0.04] border border-white/5 rounded-xl py-3 px-1">
                <span className="font-mono text-2xl sm:text-4xl md:text-5xl font-extrabold text-off-white tracking-wider tabular-nums text-white">
                  {mounted ? padZero(timeLeft.seconds) : "00"}
                </span>
                <span className="text-[10px] sm:text-xs text-concrete uppercase tracking-widest mt-1.5 font-semibold">
                  {locale === "ar" ? "ثانية" : "SECS"}
                </span>
              </div>
            </div>

            {timeLeft.isExpired && (
              <p className="mt-4 text-center font-mono text-xs sm:text-sm text-off-white font-bold tracking-widest bg-white/10 py-2 rounded-lg">
                🔥 THE DROP IS LIVE NOW · حان موعد الإطلاق
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Scroll Down Invitation to Footer */}
      <footer className="relative z-10 w-full flex flex-col items-center justify-center pt-4 text-concrete/70">
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
