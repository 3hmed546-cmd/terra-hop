"use client";

import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Pause } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { AnimatedLogo } from "@/components/motion/animated-logo";
import { loginHoodies, loginHoodieIntervalMs, type LoginHoodie } from "@/content/login-hoodies";
import {
  loadGalleryImages,
  saveGalleryImages,
  getDeletedImageIds,
  GALLERY_CHANNEL_NAME,
  type GalleryImage,
} from "@/lib/admin/gallery";
import { useLocale } from "@/lib/locale-context";
import type { home } from "@/content/home";

type HeroProps = { hero: typeof home.hero };

export function Hero({ hero }: HeroProps) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hoodiesList, setHoodiesList] = useState<LoginHoodie[]>(loginHoodies);
  const { t, locale } = useLocale();

  // Sync active header hoodies from live gallery
  const syncGallery = useCallback((customGallery?: GalleryImage[]) => {
    const gallery = customGallery || loadGalleryImages();
    const activeHeaders = gallery.filter((g) => g.category === "header");
    const activeSrcs = new Set(activeHeaders.map((g) => g.src));

    // Standard hoodies still in gallery
    const filteredStandard = loginHoodies.filter((h) => activeSrcs.has(h.src));

    // Custom headers added in gallery
    const customHeaders = activeHeaders.filter(
      (g) => !loginHoodies.some((lh) => lh.src === g.src)
    );
    const extraHoodies: LoginHoodie[] = customHeaders.map((g) => ({
      src: g.src,
      name: g.title,
      glow: "#232323",
      caption: {
        ar: { prefix: "تميز", accent: "بأسلوبك", sub: g.title },
        en: { prefix: "STAND OUT", accent: "YOUR WAY", sub: g.title },
      },
    }));

    const nextList = [...filteredStandard, ...extraHoodies];
    if (nextList.length > 0) {
      setHoodiesList(nextList);
      setIndex((curr) => (curr >= nextList.length ? 0 : curr));
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    syncGallery();

    const fetchServerGallery = () => {
      fetch("/api/media", { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          if (data.images && Array.isArray(data.images)) {
            const localDeleted = new Set(getDeletedImageIds());
            const clean = data.images.filter((img: GalleryImage) => !localDeleted.has(img.id));
            saveGalleryImages(clean, false);
            syncGallery(clean);
          }
        })
        .catch(() => {});
    };

    // 1. Fetch immediately on mount so customer sees any newly added images without delay
    fetchServerGallery();

    // 2. Poll gently every 10s for real-time live static updates for all customers
    const pollInterval = window.setInterval(fetchServerGallery, 10000);

    // 3. Instant cross-tab real-time sync with BroadcastChannel
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        channel = new BroadcastChannel(GALLERY_CHANNEL_NAME);
        channel.onmessage = (e) => {
          if (e.data?.type === "UPDATE") {
            syncGallery(e.data.images);
          }
        };
      } catch {
        // ignore
      }
    }

    // 4. Same-tab and storage events
    const onSync = () => syncGallery();
    window.addEventListener("terra_gallery_changed", onSync);
    window.addEventListener("storage", onSync);
    window.addEventListener("focus", fetchServerGallery);

    return () => {
      window.clearInterval(pollInterval);
      channel?.close();
      window.removeEventListener("terra_gallery_changed", onSync);
      window.removeEventListener("storage", onSync);
      window.removeEventListener("focus", fetchServerGallery);
    };
  }, [syncGallery]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const running = playing && !reduced;

  useEffect(() => {
    if (!running || hoodiesList.length === 0) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % hoodiesList.length);
    }, loginHoodieIntervalMs);
    return () => window.clearInterval(id);
  }, [running, index, hoodiesList.length]);

  const current = hoodiesList[index] ?? hoodiesList[0] ?? loginHoodies[0];
  const currentCaption = current
    ? locale === "ar"
      ? current.caption.ar
      : current.caption.en
    : loginHoodies[0].caption.ar;

  return (
    <section
      dir="ltr"
      className="on-dark relative isolate flex min-h-[620px] h-svh flex-col justify-between overflow-hidden bg-obsidian text-off-white text-left select-none"
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
      <div className="hidden md:flex absolute inset-0 -z-10 pointer-events-none items-end justify-end md:pr-[5%] lg:pr-[10%]">
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

      {/* Rotating Hoodie Images Showcase - Mobile (Large & Fills space with NO bottom gap, matching Image 2) */}
      <div className="flex md:hidden absolute inset-x-0 bottom-0 top-[235px] sm:top-[250px] -z-10 pointer-events-none items-end justify-center overflow-hidden">
        <div className="relative h-[78vh] w-full max-w-[480px]">
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

      {/* MOBILE LAYOUT (< md) */}
      <div className="flex md:hidden flex-col items-center justify-start flex-1 px-4 pt-16 z-10">
        {/* Big White TERRA HOP Logo in Mobile (no bottom margin so gap to caption is exact) */}
        <h1 className="w-full max-w-[280px] sm:max-w-[320px] text-center mb-0">
          <AnimatedLogo>
            <Logo className="w-full drop-shadow-md" />
          </AnimatedLogo>
        </h1>

        {/* Mobile Upper Caption (Centered, exactly 15px below Logo, ~20px above model's head, 30% larger font) */}
        <div
          dir={locale === "ar" ? "rtl" : "ltr"}
          className="flex flex-col items-center text-center mt-[15px] z-10 select-none"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`m-caption-${index}`}
              initial={mounted ? { opacity: 0, y: 10 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.38, ease: "easeOut" }}
              className="flex flex-col items-center"
            >
              <div className="flex items-center justify-center gap-2.5">
                <span className="text-[26px] sm:text-[31px] font-extrabold text-white tracking-tight drop-shadow-sm leading-tight">
                  {currentCaption.prefix}
                </span>
                <span className="bg-[#b31428] text-white text-[23px] sm:text-[26px] font-extrabold px-3.5 py-1 rounded-md shadow-md leading-tight">
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
                className="mt-2.5 text-[15px] sm:text-[18px] font-semibold text-stone-200/95 tracking-wide drop-shadow-md text-center max-w-[340px] sm:max-w-md"
              >
                {currentCaption.sub}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Bar: CTA on left, Carousel Indicator on right (Responsive for both Mobile & Desktop) */}
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

        {/* Hoodie Carousel Controls (Dashes indicator & Play/Pause button) */}
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
                key={h.name}
                className={`h-1 w-2.5 sm:w-4 rounded-full transition-colors duration-300 ${
                  i === index ? "bg-off-white" : "bg-concrete/40"
                }`}
              />
            ))}
          </ul>

          {!reduced && (
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
      </div>
    </section>
  );
}
