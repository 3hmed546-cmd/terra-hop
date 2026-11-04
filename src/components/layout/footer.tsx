"use client";

import Link from "next/link";
import { Globe } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { WhatsAppIcon, InstagramIcon, FacebookIcon, TikTokIcon } from "@/components/ui/social-icons";
import { useLocale } from "@/lib/locale-context";
import type { home } from "@/content/home";

const link = "underline-offset-4 hover:underline";

export function Footer({ footer }: { footer: typeof home.footer }) {
  const { locale, toggleLocale, t } = useLocale();
  const currentYear = 2026;

  const navColumns = [
    [
      { href: "/shop", label: t.footer.columns.shop },
      { href: "/about", label: t.footer.columns.about },
      { href: "/help", label: t.footer.columns.help },
    ],
    [
      { href: "/shipping", label: t.footer.columns.shipping },
      { href: "/privacy", label: t.footer.columns.privacy },
      { href: "/terms", label: t.footer.columns.terms },
    ],
  ];

  return (
    <footer dir="ltr" className="on-dark bg-obsidian text-off-white text-left w-full max-w-full overflow-hidden">
      <div className="mx-auto w-full max-w-[1280px] px-4 py-12 md:px-6 lg:px-10 lg:py-16">
        <div className="grid gap-12 md:grid-cols-12 text-left">
          {/* Brand & Tagline - Always on Left */}
          <div className="md:col-span-4 text-left">
            <Logo className="w-56 sm:w-64 md:w-60 lg:w-72 max-w-full" />
            <p className="mt-5 text-sm text-(--fg-muted)">{t.footer.tagline}</p>

            {/* Language Switcher in Footer */}
            <div className="mt-5 flex justify-start">
              <button
                type="button"
                onClick={toggleLocale}
                className="inline-flex items-center gap-2 rounded-full border border-off-white/30 px-3.5 py-1.5 text-xs font-bold uppercase text-off-white hover:bg-off-white/10 transition-colors cursor-pointer"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>{locale === "ar" ? "English" : "العربية"}</span>
              </button>
            </div>
          </div>

          {/* Navigation Links - Always LTR columns */}
          <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-8 md:col-span-4 text-left">
            {navColumns.map((col, i) => (
              <ul key={i} className="space-y-3 text-left">
                {col.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={link}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
          </nav>

          {/* Contact Details - Always LTR */}
          <div className="md:col-span-4 text-left">
            <h2 className="text-label text-(--fg-muted)">{t.footer.contact}</h2>
            <ul className="mt-4 space-y-3 text-left">
              <li>
                <a
                  href="tel:+201285694670"
                  dir="ltr"
                  className={`${link} tabular-nums font-mono block font-medium`}
                >
                  +20 128 569 4670
                </a>
              </li>
              <li>
                <a href="mailto:terr3hop@gmail.com" className={`${link} block`}>
                  terr3hop@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Centered Responsive Social Icons Bar on mobile and desktop */}
        <div className="mt-10 border-t border-charcoal/70 pt-8 flex items-center justify-center">
          <div className="flex items-center justify-center gap-4 sm:gap-5 flex-wrap">
            <a
              href={footer.socials.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-off-white text-obsidian transition-transform duration-200 hover:scale-110 hover:bg-white shadow-sm"
            >
              <WhatsAppIcon />
            </a>
            <a
              href={footer.socials.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-off-white text-obsidian transition-transform duration-200 hover:scale-110 hover:bg-white shadow-sm"
            >
              <InstagramIcon />
            </a>
            <a
              href={footer.socials.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-off-white text-obsidian transition-transform duration-200 hover:scale-110 hover:bg-white shadow-sm"
            >
              <FacebookIcon />
            </a>
            <a
              href={footer.socials.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-off-white text-obsidian transition-transform duration-200 hover:scale-110 hover:bg-white shadow-sm"
            >
              <TikTokIcon />
            </a>
          </div>
        </div>

        {/* Bottom Bar: Copyright on left, Developed & Designed by NASAQ in center */}
        <div className="mt-12 border-t border-charcoal pt-6 grid grid-cols-1 md:grid-cols-3 items-center gap-4 text-sm text-(--fg-muted) text-left">
          <p className="text-left text-xs md:text-sm">
            &copy; {currentYear} {footer.copyright}
          </p>
          <p className="text-center text-xs md:text-sm uppercase tracking-[0.14em]">
            Developed &amp; Designed by{" "}
            <span className="font-extrabold text-off-white tracking-[0.2em]">
              NASAQ
            </span>
          </p>
          <div className="hidden md:block" aria-hidden="true" />
        </div>
      </div>
    </footer>
  );
}
