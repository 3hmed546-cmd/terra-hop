"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { loginHoodies, loginHoodieIntervalMs, type LoginHoodie } from "@/content/login-hoodies";
import { useLive } from "@/lib/use-live";
import { uiStrings } from "@/lib/ui-strings";
import { Logo } from "@/components/ui/logo";

const t = uiStrings.adminLogin;

export function HoodieShowcase() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);

  // Read live from database slots
  const { data: liveSite } = useLive("media");

  const hoodiesList = useMemo<LoginHoodie[]>(() => {
    const slots = liveSite?.slots;
    const placements = slots?.login_showcase || slots?.hero_carousel;
    if (Array.isArray(placements) && placements.length > 0) {
      return placements.map((p: any) => ({
        src: p.url,
        name: p.alt?.ar || p.alt?.en || "هودي",
        glow: p.meta?.glow || "#232323",
        caption: p.meta?.caption || {
          ar: { prefix: "تميز", accent: "بأسلوبك", sub: p.alt?.ar || "" },
          en: { prefix: "STAND OUT", accent: "YOUR WAY", sub: p.alt?.en || "" },
        },
      }));
    }
    return loginHoodies;
  }, [liveSite]);

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
      if (!document.hidden) setIndex((i) => (i + 1) % hoodiesList.length);
    }, loginHoodieIntervalMs);
    return () => window.clearInterval(id);
  }, [running, index, hoodiesList.length]);

  const current = hoodiesList[index] ?? hoodiesList[0] ?? null;

  return (
    <div className="relative isolate flex h-full w-full flex-col justify-between p-4 sm:p-6 lg:p-10">
      {/* Dynamic radial glow matching the active hoodie */}
      {current && (
        <div
          className="pointer-events-none absolute inset-0 -z-10 transition-colors duration-1000 ease-out"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${current.glow}55 0%, transparent 70%)`,
          }}
          aria-hidden="true"
        />
      )}

      {/* Top Header: Brand Logo on the left, subtle Play/Pause toggle on the right */}
      <div className="relative z-20 flex items-center justify-between">
        <Link
          href="/"
          aria-label={uiStrings.logoAlt}
          className="block w-28 sm:w-36 lg:w-44 transition-opacity hover:opacity-85 text-off-white"
        >
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="font-mono text-xs text-concrete hover:text-off-white px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          aria-pressed={!playing}
        >
          {playing ? t.pause : t.play}
        </button>
      </div>

      {/* Central Image Showcase: Proportional, responsive, fully visible, complete */}
      <div className="relative my-auto flex flex-1 items-center justify-center w-full min-h-0 py-3 sm:py-5">
        <div className="relative w-full h-full max-w-[320px] sm:max-w-[400px] lg:max-w-[480px] aspect-[4/5] max-h-[300px] sm:max-h-[380px] lg:max-h-[520px] flex items-center justify-center">
          {hoodiesList.map((h, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={h.src || i}
              src={h.src}
              alt={`${t.imageAlt} - ${h.name}`}
              width={900}
              height={965}
              decoding="async"
              fetchPriority={i === 0 ? "high" : "auto"}
              className={`absolute inset-0 m-auto max-h-full max-w-full object-contain filter drop-shadow-[0_12px_28px_rgba(0,0,0,0.6)] transition-all duration-700 ease-out ${
                i === index ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Clean Centered Pagination Dots */}
      <div className="relative z-20 flex items-center justify-center gap-1.5 pt-2 pb-1" aria-hidden="true">
        {hoodiesList.map((h, i) => (
          <button
            key={h.src || i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`عرض الصورة ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === index ? "w-6 bg-off-white" : "w-1.5 bg-concrete/30 hover:bg-concrete/60"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
