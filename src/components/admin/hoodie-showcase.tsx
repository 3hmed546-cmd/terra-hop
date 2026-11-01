"use client";

import { useEffect, useState } from "react";
import { loginHoodies, loginHoodieIntervalMs } from "@/content/login-hoodies";
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

// Cross-fades to the next hoodie every 5 seconds. Pausable (WCAG 2.2.2), stops when the tab is hidden,
// and does not auto-advance when the visitor asks for reduced motion.
export function HoodieShowcase() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);

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

  return (
    <section aria-label={t.showcaseLabel} className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-[260px] flex-1">
        {/* Spotlight behind the photo. One layer per hoodie, cross-fading together with the photo,
            so light and dark garments both stand out against the black panel. */}
        {loginHoodies.map((h, i) => (
          <div
            key={`glow-${h.src}`}
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 transition-opacity duration-1000 ease-out ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
            style={{
              background: `radial-gradient(ellipse 62% 55% at 50% 52%, ${h.glow} 0%, ${h.glow}99 30%, ${h.glow}40 60%, ${h.glow}00 100%)`,
            }}
          />
        ))}

        {loginHoodies.map((h, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- local static WebP, no optimization needed
          <img
            key={h.src}
            src={h.src}
            alt=""
            aria-hidden="true"
            width={900}
            height={965}
            decoding="async"
            fetchPriority={i === 0 ? "high" : "auto"}
            // The photos are cropped at the waist: fade the bottom edge into the panel so the cut is invisible.
            style={{
              WebkitMaskImage: "linear-gradient(to bottom, #000 80%, transparent 100%)",
              maskImage: "linear-gradient(to bottom, #000 80%, transparent 100%)",
            }}
            className={`absolute inset-0 h-full w-full object-contain object-bottom transition-[opacity,transform] duration-1000 ease-out ${
              i === index ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-95 opacity-0"
            }`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 pt-4">
        <p aria-live="off" className="text-label">
          <span className="sr-only">
            {t.hoodieOf.replace("{n}", String(index + 1)).replace("{total}", String(loginHoodies.length))}.{" "}
          </span>
          {ARABIC_HOODIE_NAMES[current.name] ?? current.name}
        </p>
        <div className="flex items-center gap-3">
          <ul className="flex gap-1.5" aria-hidden="true">
            {loginHoodies.map((h, i) => (
              <li
                key={h.name}
                className={`h-0.5 w-5 transition-colors duration-300 ${
                  i === index ? "bg-off-white" : "bg-concrete/50"
                }`}
              />
            ))}
          </ul>
          {!reduced && (
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-pressed={!playing}
              className="text-label min-h-8 px-1 hover:underline cursor-pointer"
            >
              {playing ? t.pause : t.play}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
