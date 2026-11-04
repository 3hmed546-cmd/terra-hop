"use client";

import { useEffect, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Pause } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { AnimatedLogo } from "@/components/motion/animated-logo";
import { loginHoodieIntervalMs } from "@/content/login-hoodies";
import { useLive } from "@/lib/use-live";
import { useLocale } from "@/lib/locale-context";
import type { home } from "@/content/home";

export const HERO_CAPTIONS = [
  {
    ar: { prefix: "تميز", accent: "بأسلوبك", sub: "أصالة ستريت وير مصرية بهوية عصرية" },
    en: { prefix: "STAND", accent: "OUT", sub: "Egyptian streetwear culture redefined" },
  },
  {
    ar: { prefix: "صُنِع", accent: "ليعبر عنك", sub: "تفاصيل استثنائية وخامة قطن مصري فاخر 100%" },
    en: { prefix: "CRAFTED", accent: "FOR YOU", sub: "100% premium Egyptian combed cotton" },
  },
  {
    ar: { prefix: "طاقة", accent: "الشارع", sub: "قصات أوفرسايز مريحة مستوحاة من ثقافة المدن" },
    en: { prefix: "STREET", accent: "ENERGY", sub: "Effortless oversized urban silhouettes" },
  },
  {
    ar: { prefix: "إطلالة", accent: "جريئة", sub: "طباعة ثلاثية الأبعاد باف برينت مجسمة ومتقنة" },
    en: { prefix: "BOLD", accent: "IDENTITY", sub: "Bespoke 3D puff print & drop-shoulder cuts" },
  },
  {
    ar: { prefix: "راحة", accent: "بلا حدود", sub: "نسيج ثقيل ودافئ صُمم خصيصاً لأيام الشتاء" },
    en: { prefix: "PURE", accent: "COMFORT", sub: "Ultra-heavyweight fleece crafted for warmth" },
  },
  {
    ar: { prefix: "حضور", accent: "استثنائي", sub: "إصدارات حصرية وقطع فريدة لكل يوم" },
    en: { prefix: "ICONIC", accent: "PRESENCE", sub: "Curated seasonal drops in limited batches" },
  },
  {
    ar: { prefix: "أسلوب", accent: "الجيل الجديد", sub: "ملابس شوارع تصنع الفارق في كل تفصيلة" },
    en: { prefix: "NEXT", accent: "GEN", sub: "Streetwear that reflects who you truly are" },
  },
  {
    ar: { prefix: "جودة", accent: "تدوم", sub: "حياكة معززة وألوان ثابتة تدوم طويلاً" },
    en: { prefix: "BUILT", accent: "TO LAST", sub: "Reinforced tailoring and long-lasting dyes" },
  },
  {
    ar: { prefix: "أناقة", accent: "عصرية", sub: "توازن مثالي بين الراحة المطلقة والأناقة المعاصرة" },
    en: { prefix: "EFFORTLESS", accent: "STYLE", sub: "Modern street poise with effortless attitude" },
  },
  {
    ar: { prefix: "انضم", accent: "لمجتمعنا", sub: "عائلة TERRA HOP تكبر في كل مكان" },
    en: { prefix: "JOIN", accent: "THE MOVEMENT", sub: "The TERRA HOP lifestyle across Egypt" },
  },
];

type HeroProps = { hero: typeof home.hero };

export function Hero({ hero }: HeroProps) {
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { t, locale } = useLocale();

  // Real-time live data from SSE stream (/api/public/stream & /api/public/site)
  const { data: liveSite } = useLive("media");

  // Derive active hero hoodies from server database live slots
  const hoodiesList = useMemo<{ src: string; name: string; glow: string }[]>(() => {
    const heroPlacements = liveSite?.slots?.hero_carousel;
    if (Array.isArray(heroPlacements)) {
      return heroPlacements.map((p: any) => {
        const meta = p.meta || {};
        return {
          src: p.url,
          name: p.alt?.ar || p.alt?.en || meta.name || "TERRA HOP",
          glow: meta.glow || "#34445c",
        };
      });
    }

    return [];
  }, [liveSite]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Ensure index stays in bounds if images were deleted
  useEffect(() => {
    if (hoodiesList.length > 0 && index >= hoodiesList.length) {
      setIndex(0);
    }
  }, [hoodiesList.length, index]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const running = playing && !reduced && hoodiesList.length > 1;

  useEffect(() => {
    if (!running || hoodiesList.length === 0) return;
    const id = window.setInterval(() => {
      if (!document.hidden) {
        setIndex((i) => (i + 1) % hoodiesList.length);
        setStep((s) => s + 1);
      }
    }, loginHoodieIntervalMs);
    return () => window.clearInterval(id);
  }, [running, index, hoodiesList.length]);

  // Captions cycle across the 10 available captions for up to 10 images.
  // For images beyond 10 (11th, etc.), no caption is displayed.
  const activeCaptionObj = index < 10 ? HERO_CAPTIONS[step % HERO_CAPTIONS.length] : null;
  const currentCaption = activeCaptionObj
    ? locale === "ar"
      ? activeCaptionObj.ar
      : activeCaptionObj.en
    : null;

  return (
    <section
      dir="ltr"
      className="on-dark relative isolate flex min-h-[620px] h-svh flex-col justify-between overflow-hidden w-full max-w-full bg-obsidian text-off-white text-left select-none"
    >
      {/* Background Spotlight Glows */}
      <div className="absolute inset-0 pointer-events-none -z-20 overflow-hidden" aria-hidden="true">
        {hoodiesList.map((h, i) => (
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
      <div className="hidden md:flex absolute inset-0 -z-10 pointer-events-none items-end justify-end md:pr-[5%] lg:pr-[10%] overflow-hidden">
        <div className="relative h-full w-full max-w-[850px]">
          {hoodiesList.map((h, i) => (
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

      {/* Rotating Hoodie Images Showcase - Mobile (Positioned below caption with no face overlap) */}
      <div className="flex md:hidden absolute inset-x-0 bottom-0 top-[220px] sm:top-[240px] -z-10 pointer-events-none items-end justify-center overflow-hidden">
        <div className="relative h-[72vh] w-full max-w-[440px]">
          {hoodiesList.map((h, i) => (
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
              className={`absolute inset-0 h-full w-full object-contain object-bottom transition-[opacity,transform] duration-1000 ease-out ${
                i === index ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
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

      {/* Desktop Bottom-Right Caption (Rotating smoothly with each slide) */}
      {currentCaption && (
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
                <span className="bg-[#b31428] text-white text-2xl lg:text-3xl xl:text-4xl font-extrabold px-3 py-1 rounded-md shadow-md">
                  {currentCaption.accent}
                </span>
              </div>
              <p className="mt-2 text-sm lg:text-base font-semibold text-stone-200/90 tracking-wide drop-shadow-sm max-w-sm">
                {currentCaption.sub}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* MOBILE LAYOUT (< md) - Clean logo and responsive compact caption above model */}
      <div className="flex md:hidden flex-col items-center justify-start flex-1 px-4 pt-[32px] sm:pt-[40px] z-10">
        {/* Big White TERRA HOP Logo in Mobile */}
        <h1 className="w-full max-w-[260px] sm:max-w-[300px] text-center mb-0">
          <AnimatedLogo>
            <Logo className="w-full drop-shadow-md" />
          </AnimatedLogo>
        </h1>

        {/* Mobile Upper Caption (Centered, cleanly spaced between Logo and model head) */}
        {currentCaption && (
          <div
            dir={locale === "ar" ? "rtl" : "ltr"}
            className="flex flex-col items-center text-center mt-3 z-10 select-none"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`m-caption-${index}`}
                initial={mounted ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.38, ease: "easeOut" }}
                className="flex flex-col items-center"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm leading-tight">
                    {currentCaption.prefix}
                  </span>
                  <span className="bg-[#b31428] text-white text-xl sm:text-2xl font-extrabold px-3 py-0.5 rounded-md shadow-md leading-tight">
                    {currentCaption.accent}
                  </span>
                </div>
                <p
                  style={{
                    fontFamily:
                      locale === "ar"
                        ? "'Cairo', var(--font-inter), system-ui, sans-serif"
                        : "inherit",
                  }}
                  className="mt-1.5 text-xs sm:text-sm font-semibold text-stone-200/90 tracking-wide drop-shadow-md text-center max-w-[320px]"
                >
                  {currentCaption.sub}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Bottom Bar: CTA on left, Carousel Indicator on right */}
      <div className="flex items-end justify-between gap-4 px-4 pb-6 md:px-6 lg:px-10 lg:pb-12 z-10 text-left">
        {/* Shopping CTA Button - Smooth entrance animation from bottom settling into place */}
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.75,
            delay: 0.3,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mb-[30px] ml-[15px]"
        >
          <ButtonLink
            href="/shop"
            variant="secondary"
            className="border-off-white! text-xs sm:text-sm py-2.5 px-5 hover:scale-105 active:scale-95 transition-all bg-transparent"
          >
            {locale === "ar" ? "تسوق الآن ←" : `${t.hero.cta} →`}
          </ButtonLink>
        </motion.div>

        {/* Hoodie Carousel Controls */}
        {hoodiesList.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.75,
              delay: 0.45,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="flex items-center gap-3 text-xs font-mono uppercase tracking-widest text-graphite pb-1"
          >
            <ul className="flex gap-1" aria-hidden="true">
              {hoodiesList.map((h, i) => (
                <li
                  key={h.src}
                  className={`h-1 w-2.5 sm:w-4 rounded-full transition-colors duration-300 ${
                    i === index ? "bg-off-white" : "bg-concrete/40"
                  }`}
                />
              ))}
            </ul>

            {!reduced && hoodiesList.length > 1 && (
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                aria-pressed={!playing}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/40 text-off-white backdrop-blur-xs hover:border-white/60 hover:bg-black/60 transition cursor-pointer"
                title={playing ? t.hero.pause : t.hero.play}
                aria-label={playing ? t.hero.pause : t.hero.play}
              >
                {playing ? (
                  <Pause className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                )}
              </button>
            )}
          </motion.div>
        )}
      </div>
    </section>
  );
}
