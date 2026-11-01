"use client";

import { useEffect, useState, useCallback } from "react";
import { loginHoodies, loginHoodieIntervalMs, type LoginHoodie } from "@/content/login-hoodies";
import { loadGalleryImages, GALLERY_CHANNEL_NAME } from "@/lib/admin/gallery";
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
  const [hoodiesList, setHoodiesList] = useState<LoginHoodie[]>(loginHoodies);

  const syncGallery = useCallback(() => {
    const gallery = loadGalleryImages();
    const activeHeaders = gallery.filter((g) => g.category === "header");
    const activeSrcs = new Set(activeHeaders.map((g) => g.src));

    const filtered = loginHoodies.filter((h) => activeSrcs.has(h.src));
    if (filtered.length > 0) {
      setHoodiesList(filtered);
      setIndex((curr) => (curr >= filtered.length ? 0 : curr));
    }
  }, []);

  useEffect(() => {
    syncGallery();

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        channel = new BroadcastChannel(GALLERY_CHANNEL_NAME);
        channel.onmessage = (e) => {
          if (e.data?.type === "UPDATE") syncGallery();
        };
      } catch {
        // ignore
      }
    }

    const onSync = () => syncGallery();
    window.addEventListener("terra_gallery_changed", onSync);
    window.addEventListener("storage", onSync);

    return () => {
      channel?.close();
      window.removeEventListener("terra_gallery_changed", onSync);
      window.removeEventListener("storage", onSync);
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

  return (
    <section aria-label={t.showcaseLabel} className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-[260px] flex-1">
        {/* Spotlight behind the photo. One layer per hoodie, cross-fading together with the photo,
            so light and dark garments both stand out against the black panel. */}
        {hoodiesList.map((h, i) => (
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

        {/* Hoodie photo. An absolute stack with opacity cross-fade matches the spotlight timing. */}
        {hoodiesList.map((h, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={h.src}
            src={h.src}
            alt=""
            aria-hidden="true"
            width={720}
            height={860}
            decoding="async"
            fetchPriority={i === 0 ? "high" : "auto"}
            style={{
              WebkitMaskImage: "linear-gradient(to bottom, #000 80%, transparent 98%)",
              maskImage: "linear-gradient(to bottom, #000 80%, transparent 98%)",
            }}
            className={`pointer-events-none absolute inset-0 h-full w-full object-contain object-bottom transition-[opacity,transform] duration-1000 ease-out ${
              i === index ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-95 opacity-0"
            }`}
          />
        ))}
      </div>

      {/* Footer bar with hoodie name, slide dots and pause button */}
      <div className="relative z-10 flex items-center justify-between border-t border-white/10 px-6 py-4 text-xs font-mono uppercase tracking-widest text-concrete">
        <span aria-live="polite" aria-atomic="true">
          {ARABIC_HOODIE_NAMES[current.name] ?? current.name}
        </span>

        <div className="flex items-center gap-4">
          <ul className="flex gap-1.5" aria-hidden="true">
            {hoodiesList.map((h, i) => (
              <li
                key={h.name}
                className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                  i === index ? "bg-white" : "bg-white/20"
                }`}
              />
            ))}
          </ul>

          {!reduced && (
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-pressed={!playing}
              className="text-concrete hover:text-white transition-colors cursor-pointer"
            >
              {playing ? t.pause : t.play}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
