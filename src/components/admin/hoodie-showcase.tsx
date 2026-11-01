"use client";

import { useEffect, useState, useMemo } from "react";
import { loginHoodies, loginHoodieIntervalMs, type LoginHoodie } from "@/content/login-hoodies";
import { useLive } from "@/lib/use-live";
import { uiStrings } from "@/lib/ui-strings";

const t = uiStrings.adminLogin;

const ARABIC_HOODIE_NAMES: Record<string, string> = {
  BLACK: "أسود ملكي",
  "BABY BLUE": "بيبي بلو",
  CREAM: "كريمي / أوف وايت",
  MAROON: "مارون / نبيتي",
  "FOREST GREEN": "أخضر غامق",
  CHARCOAL: "فحمي",
  "ROYAL BLUE": "أزرق ملكي",
};

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

  const current = hoodiesList[index] ?? hoodiesList[0] ?? loginHoodies[0];
  const arabicName = current?.name
    ? ARABIC_HOODIE_NAMES[current.name.toUpperCase()] ?? current.name
    : "";

  return (
    <div className="relative isolate flex h-full flex-col justify-between overflow-hidden bg-obsidian p-8 text-off-white">
      {/* Dynamic radial glow matching the active hoodie */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 transition-colors duration-1000 ease-out"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${current.glow} 0%, transparent 65%)`,
        }}
        aria-hidden="true"
      />

      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-concrete">
          TERRA HOP ARCHIVE
        </span>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="font-mono text-xs text-concrete hover:text-off-white"
          aria-pressed={!playing}
        >
          {playing ? t.pause : t.play}
        </button>
      </div>

      <div className="relative my-auto aspect-square w-full max-w-[420px] self-center">
        {hoodiesList.map((h, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={h.src}
            src={h.src}
            alt={`${t.imageAlt} - ${h.name}`}
            width={900}
            height={965}
            decoding="async"
            fetchPriority={i === 0 ? "high" : "auto"}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-1000 ease-out ${
              i === index ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-xs text-concrete">DROP 01 &bull; HOODIES</span>
          <p className="text-sm font-medium tracking-wide">
            {current.name} &bull; {arabicName}
          </p>
        </div>

        <ul className="flex gap-1.5" aria-hidden="true">
          {hoodiesList.map((h, i) => (
            <li
              key={h.src}
              className={`h-1.5 w-6 rounded-full transition-colors duration-500 ${
                i === index ? "bg-off-white" : "bg-concrete/30"
              }`}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
