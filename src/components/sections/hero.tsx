"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { AnimatedLogo } from "@/components/motion/animated-logo";
import { Reveal } from "@/components/motion/reveal";
import { StatusLabel } from "@/components/ui/status-label";
import { loginHoodies, loginHoodieIntervalMs } from "@/content/login-hoodies";
import { useLocale } from "@/lib/locale-context";
import type { home } from "@/content/home";

type HeroProps = { hero: typeof home.hero };

export function Hero({ hero }: HeroProps) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { t, locale } = useLocale();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const running = playing && !reduced;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % loginHoodies.length);
    }, loginHoodieIntervalMs);
    return () => window.clearInterval(id);
  }, [running, index]);

  const current = loginHoodies[index];
  const currentCaption = locale === "ar" ? current.caption.ar : current.caption.en;
  const localizedColor =
    locale === "ar" ? t.hero.hoodies[current.name] ?? current.name : current.name;

  return (
    <section
      dir="ltr"
      className="on-dark relative isolate flex min-h-[620px] h-svh flex-col justify-between overflow-hidden bg-obsidian text-off-white text-left select-none"
    >
      {/* Background Spotlight Glows */}
      <div className="absolute inset-0 pointer-events-none -z-20 overflow-hidden" aria-hidden="true">
        {loginHoodies.map((h, i) => (
          <div
            key={`glow-${h.src}`}
            className={`absolute inset-0 transition-opacity duration-1000 ease-out ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
            style={{
              background: `radial-gradient(ellipse 65% 55% at 55% 52%, ${h.glow} 0%, ${h.glow}99 30%, ${h.glow}35 60%, transparent 100%)`,
            }}
          />
        ))}
      </div>

      {/* Rotating Hoodie Images Showcase - Desktop (aligned to right bottom) */}
      <div className="hidden md:flex absolute inset-0 -z-10 pointer-events-none items-end justify-end md:pr-[5%] lg:pr-[10%]">
        <div className="relative h-full w-full max-w-[850px]">
          {loginHoodies.map((h, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={h.src}
              src={h.src}
              alt=""
              aria-hidden="true"
              width={900}
              height={965}
              decoding="async"
              fetchPriority={i === 0 ? "high" : "auto"}
              style={{
                WebkitMaskImage: "linear-gradient(to bottom, #000 82%, transparent 98%)",
                maskImage: "linear-gradient(to bottom, #000 82%, transparent 98%)",
              }}
              className={`absolute inset-0 h-full w-full object-contain object-bottom transition-[opacity,transform] duration-1000 ease-out ${
                i === index ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-95 opacity-0"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Rotating Hoodie Images Showcase - Mobile (Large & Fills space with NO bottom gap, matching Image 2) */}
      <div className="flex md:hidden absolute inset-x-0 bottom-0 top-56 sm:top-60 -z-10 pointer-events-none items-end justify-center overflow-hidden">
        <div className="relative h-[78vh] w-full max-w-[480px]">
          {loginHoodies.map((h, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`m-${h.src}`}
              src={h.src}
              alt=""
              aria-hidden="true"
              width={900}
              height={965}
              decoding="async"
              fetchPriority={i === 0 ? "high" : "auto"}
              className={`absolute inset-0 h-full w-full object-contain object-bottom scale-110 origin-bottom transition-[opacity,transform] duration-1000 ease-out ${
                i === index ? "translate-y-0 opacity-100" : "translate-y-3 scale-105 opacity-0"
              }`}
            />
          ))}
        </div>
      </div>

      {/* DESKTOP LAYOUT (md:flex) */}
      <div className="hidden md:flex flex-1 items-center px-4 md:px-6 lg:px-10 pt-16 md:pt-0">
        {/* Main Big Logo on left */}
        <h1 className="w-full md:w-[54%] lg:w-[48%] z-10 text-left">
          <AnimatedLogo>
            <Logo className="w-full drop-shadow-md" />
          </AnimatedLogo>
        </h1>
      </div>

      {/* Desktop Bottom-Right Caption (تحت على اليمين - Rotating smoothly with each hoodie slide) */}
      <div
        dir={locale === "ar" ? "rtl" : "ltr"}
        className="hidden md:flex flex-col items-start text-right z-10 md:absolute md:bottom-28 lg:bottom-32 md:right-8 lg:right-14 max-w-md xl:max-w-xl select-none"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`d-caption-${index}`}
            initial={mounted ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.38, ease: "easeOut" }}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl lg:text-4xl xl:text-5xl font-extrabold text-white tracking-tight">
                {currentCaption.prefix}
              </span>
              <span
                className="inline-block px-4 py-1 rounded-xl text-3xl lg:text-4xl xl:text-5xl font-black text-white shadow-xl tracking-tight"
                style={{ backgroundColor: "#c8102e" }}
              >
                {currentCaption.accent}
              </span>
            </div>
            <p
              dir={locale === "ar" ? "rtl" : "ltr"}
              className="mt-2 text-sm lg:text-base xl:text-lg font-semibold text-stone-200 tracking-wide"
            >
              {currentCaption.sub}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* MOBILE LAYOUT (md:hidden) Top & Center Section (Matching Reference Image 2 Perfectly) */}
      <div className="flex md:hidden flex-col items-center text-center pt-[74px] sm:pt-[78px] px-4 z-10">
        {/* 1. Animated Logo centered with breathing room from top (+15px down for clear social icon clearance) */}
        <div className="w-[72%] max-w-[280px] mx-auto">
          <AnimatedLogo>
            <Logo className="w-full drop-shadow-md" />
          </AnimatedLogo>
        </div>

        {/* 2. Caption Centered Horizontally Exactly 40px Below Logo (Shifted 10px up as requested) */}
        <div
          dir={locale === "ar" ? "rtl" : "ltr"}
          className="mt-[40px] flex flex-col items-center text-center w-full max-w-sm mx-auto select-none"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`m-caption-${index}`}
              initial={mounted ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex flex-col items-center text-center"
            >
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-md">
                  {currentCaption.prefix}
                </span>
                <span
                  className="inline-block px-3.5 py-1 rounded-xl text-2xl sm:text-3xl font-black text-white shadow-xl tracking-tight"
                  style={{ backgroundColor: "#c8102e" }}
                >
                  {currentCaption.accent}
                </span>
              </div>
              <p
                dir={locale === "ar" ? "rtl" : "ltr"}
                className="mt-2 text-xs sm:text-sm font-semibold text-stone-200/95 tracking-wide drop-shadow-md text-center max-w-[260px] sm:max-w-xs"
              >
                {currentCaption.sub}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Bar: CTA on left, Carousel Indicator on right (Responsive for both Mobile & Desktop) */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-4 pb-6 md:px-6 lg:px-10 lg:pb-12 z-10 text-left">
        <Reveal delay={0.6} className="flex flex-col items-start gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-graphite font-mono">{t.hero.label}</p>
            <StatusLabel className="text-off-white! font-bold text-sm sm:text-base">
              {locale === "ar" ? "هودي ستريت وير" : t.hero.status}
            </StatusLabel>
          </div>
          <ButtonLink href="/shop" variant="secondary" className="border-off-white! text-xs sm:text-sm py-2.5 px-5">
            {locale === "ar" ? "تسوق الآن ←" : `${t.hero.cta} →`}
          </ButtonLink>
        </Reveal>

        {/* Hoodie Carousel Controls (Color name, dashes indicator, Play/Pause / Explore) */}
        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs font-mono uppercase tracking-widest text-graphite pt-1 sm:pt-0">
          <div className="flex items-center gap-2">
            <span className="text-off-white font-bold">{localizedColor}</span>
            <span className="text-stone-400 text-[11px]">
              0{index + 1} / 0{loginHoodies.length}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <ul className="flex gap-1" aria-hidden="true">
              {loginHoodies.map((h, i) => (
                <li
                  key={h.name}
                  className={`h-1 w-3 sm:w-4 rounded-full transition-colors duration-300 ${
                    i === index ? "bg-off-white" : "bg-concrete/40"
                  }`}
                />
              ))}
            </ul>

            <Link
              href="/shop"
              className="text-label text-off-white hover:underline flex items-center gap-1 cursor-pointer ml-1"
            >
              <span>{t.hero.explore}</span>
              <span aria-hidden="true">←</span>
            </Link>

            {!reduced && (
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                aria-pressed={!playing}
                className="text-label min-h-8 px-1 text-off-white/70 hover:text-off-white hover:underline cursor-pointer"
                title={playing ? t.hero.pause : t.hero.play}
              >
                {playing ? t.hero.pause : t.hero.play}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
