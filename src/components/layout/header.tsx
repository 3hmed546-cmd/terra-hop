"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Globe } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { CartLink } from "@/components/cart/cart-link";
import { MobileMenu } from "./mobile-menu";
import { useLocale } from "@/lib/locale-context";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/ui/social-icons";
import type { home } from "@/content/home";

type Props = { header: typeof home.header; overlay?: boolean };

const linkClass = "text-label px-2 py-3 underline-offset-4 hover:underline";

export function Header({ header, overlay = false }: Props) {
  const [isScrolled, setIsScrolled] = useState(false);
  const { locale, toggleLocale, t } = useLocale();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 60);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const localizedNavLinks = [
    { href: "/shop", label: t.header.shop },
    { href: "/about", label: t.header.about },
    { href: "/help", label: t.header.help },
  ];

  const wrapper = overlay
    ? "on-dark absolute inset-x-0 top-0 z-20 text-off-white"
    : "relative border-b border-line-light bg-off-white text-obsidian";

  return (
    <>
      {/* 1. Primary Top Header (Before Scroll) */}
      <header dir="ltr" className={`${wrapper} h-14 md:h-16 text-left w-full max-w-full overflow-hidden`}>
        <div className="relative mx-auto flex h-full w-full max-w-[1280px] items-center justify-between px-4 md:px-6 lg:px-10">
          {/* Left: Mobile Menu button or Desktop nav links */}
          <div className="flex items-center gap-2 md:gap-6">
            <MobileMenu
              links={localizedNavLinks}
              labels={{ menu: t.header.menu, close: t.header.close, nav: t.header.shop }}
            />
            <nav aria-label="Primary navigation" className="hidden items-center gap-1 md:flex">
              {localizedNavLinks.map((l) => (
                <Link key={l.href} href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Center: Brand Logo - Shown ONLY on non-overlay pages (hidden on homepage hero to let animated logo shine) */}
          {!overlay && (
            <Link
              href={header.homeHref}
              aria-label={t.common.brand}
              className="w-20 sm:w-24 md:w-28 text-current absolute left-1/2 -translate-x-1/2 flex items-center justify-center transition-transform duration-200 hover:scale-105"
            >
              <Logo className="w-full h-auto" />
            </Link>
          )}

          {/* Right: Social Media Icons (on homepage overlay) OR Cart & Language (on other pages) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {overlay ? (
              // Social Media Icons in top header before scroll (WhatsApp, Facebook, Instagram, TikTok)
              <div className="flex items-center gap-3.5 sm:gap-4 text-off-white">
                <a
                  href="https://chat.whatsapp.com/EWcBrybFmbr7jbMJUJGSUk?s=sh&p=a&iam=2"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp Group"
                  className="hover:text-white transition-opacity hover:opacity-75 p-1"
                >
                  <WhatsAppIcon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                </a>
                <a
                  href="https://www.facebook.com/terrahop.wear"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="hover:text-white transition-opacity hover:opacity-75 p-1"
                >
                  <FacebookIcon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                </a>
                <a
                  href="https://www.instagram.com/terr3hop/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="hover:text-white transition-opacity hover:opacity-75 p-1"
                >
                  <InstagramIcon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                </a>
                <a
                  href="https://www.tiktok.com/@teera.hop?_r=1&_t=ZS-9BJsTH7KSZu"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="TikTok"
                  className="hover:text-white transition-opacity hover:opacity-75 p-1"
                >
                  <TikTokIcon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                </a>
              </div>
            ) : (
              // Default non-overlay pages: Language Switcher & Cart Link
              <>
                <button
                  type="button"
                  onClick={toggleLocale}
                  title={t.common.langToggle}
                  className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-obsidian/30 px-2.5 py-1 text-xs font-bold uppercase text-obsidian transition-all duration-200 hover:bg-obsidian/5 cursor-pointer"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>{locale === "ar" ? "EN" : "عربي"}</span>
                </button>
                <CartLink href={header.cart.href} label={t.header.cart} className={linkClass} showIcon={true} />
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Scrolled Animated Sticky Navigation Bar Curtain */}
      <AnimatePresence>
        {isScrolled && (
          <motion.div
            key="scrolled-sticky-navbar"
            dir="ltr"
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            role="region"
            aria-label="Sticky navigation"
            className="fixed inset-x-0 top-0 z-50 h-14 md:h-16 text-obsidian text-left"
            style={{
              backgroundColor: "rgba(244, 241, 235, 0.94)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderBottom: "1px solid rgba(8, 8, 8, 0.12)",
              boxShadow: "0 4px 20px -2px rgba(8, 8, 8, 0.08)",
            }}
          >
            <div className="relative mx-auto flex h-full w-full max-w-[1280px] items-center justify-between px-4 md:px-6 lg:px-10">
              {/* Left: Navigation links (Shop, About, Help) + Mobile Menu */}
              <div className="flex items-center gap-2 md:gap-6">
                <div className="md:hidden">
                  <MobileMenu
                    links={localizedNavLinks}
                    labels={{ menu: t.header.menu, close: t.header.close, nav: t.header.shop }}
                  />
                </div>
                <nav aria-label="Sticky primary navigation" className="hidden items-center gap-1 md:flex">
                  {localizedNavLinks.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="text-label px-2 py-3 text-obsidian underline-offset-4 hover:underline transition-opacity hover:opacity-75"
                    >
                      {l.label}
                    </Link>
                  ))}
                </nav>
              </div>

              {/* Center: Brand Logo with Smooth Compress / Scale Animation on scroll */}
              <Link
                href={header.homeHref}
                aria-label={t.common.brand}
                className="w-20 sm:w-24 md:w-28 text-obsidian absolute left-1/2 -translate-x-1/2 flex items-center justify-center transition-transform duration-200 hover:scale-105"
              >
                <motion.div
                  initial={{ scale: 0.75, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full flex items-center justify-center"
                >
                  <Logo className="w-full h-auto" />
                </motion.div>
              </Link>

              {/* Right: Language Switcher & Cart Link (Cart replaces social icons on scroll) */}
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={toggleLocale}
                  title={t.common.langToggle}
                  className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-obsidian/30 px-2.5 py-1 text-xs font-bold uppercase text-obsidian transition-all duration-200 hover:bg-obsidian/10 cursor-pointer"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>{locale === "ar" ? "EN" : "عربي"}</span>
                </button>

                <CartLink
                  href={header.cart.href}
                  label={t.header.cart}
                  className="text-label px-2 py-3 text-obsidian underline-offset-4 hover:underline transition-opacity hover:opacity-75"
                  showIcon={true}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
