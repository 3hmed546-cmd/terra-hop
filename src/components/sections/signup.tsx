"use client";

import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { WhatsAppIcon, InstagramIcon } from "@/components/ui/social-icons";
import { useLocale } from "@/lib/locale-context";
import type { home } from "@/content/home";

export function Signup({ signup }: { signup: typeof home.signup }) {
  const { t, locale } = useLocale();

  return (
    <section
      dir={locale === "ar" ? "rtl" : "ltr"}
      aria-labelledby="signup-heading"
      className="border-t border-line-light bg-off-white py-16 lg:py-24"
    >
      <Container>
        <Reveal className="mx-auto max-w-3xl">
          <div className="relative overflow-hidden rounded-3xl border border-stone-200/90 bg-linear-to-b from-stone-50 via-white to-stone-100/60 p-6 sm:p-10 md:p-12 shadow-sm">
            {/* Ambient subtle glow decoration */}
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-rose-500/10 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative z-10 flex flex-col items-start text-start">
              {/* Main Heading */}
              <h2
                id="signup-heading"
                className="text-2xl font-black tracking-tight text-obsidian sm:text-3xl md:text-4xl"
              >
                {t.signup.heading}
              </h2>

              {/* Subtitle */}
              <p className="mt-3 text-sm leading-relaxed text-graphite sm:text-base md:text-lg max-w-2xl">
                {t.signup.text}
              </p>

              {/* Exclusive Perks Badges */}
              <div className="mt-6 flex flex-wrap gap-2.5 sm:gap-3">
                <div className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-obsidian shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  <span>{t.signup.perks.codes}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-obsidian shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-obsidian" />
                  <span>{t.signup.perks.drops}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-obsidian shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-stone-400" />
                  <span>{t.signup.perks.deals}</span>
                </div>
              </div>

              {/* Big Direct WhatsApp Group CTA Button */}
              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full">
                <a
                  href={signup.whatsappGroupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center justify-center gap-3 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] px-8 py-4 text-base sm:text-lg font-black text-white shadow-lg shadow-emerald-600/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <WhatsAppIcon className="h-6 w-6 fill-current transition-transform duration-200 group-hover:scale-110" />
                  <span>{t.signup.button}</span>
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">
                    {locale === "ar" ? "دخول مباشر" : "Instant"}
                  </span>
                </a>

                {/* Direct 1-on-1 Chat option */}
                <a
                  href={signup.directChatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-300 bg-white px-5 py-4 text-xs sm:text-sm font-bold text-graphite hover:text-obsidian hover:border-obsidian transition-colors cursor-pointer"
                >
                  <WhatsAppIcon className="h-4 w-4 fill-current text-emerald-600" />
                  <span>{t.signup.directChat}</span>
                </a>
              </div>

              {/* Consent & Zero-Spam Guarantee */}
              <p className="mt-4 text-xs text-stone-500 leading-normal">
                {t.signup.consent}
              </p>

              {/* Instagram link */}
              <div className="mt-6 pt-5 border-t border-stone-200/80 w-full flex items-center justify-start">
                <a
                  href={signup.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-graphite hover:text-obsidian transition-colors"
                >
                  <InstagramIcon className="h-4 w-4" />
                  <span>Instagram @terra_hop</span>
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
