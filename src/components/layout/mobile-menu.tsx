"use client";

import Link from "next/link";
import { useRef } from "react";
import { useLocale } from "@/lib/locale-context";
import { useCart } from "@/lib/cart";
import { useLive } from "@/lib/use-live";
import { Logo } from "@/components/ui/logo";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/ui/social-icons";
import { X, Menu, ShoppingBag, Search } from "lucide-react";

type Props = {
  links: { href: string; label: string }[];
  labels: { menu: string; close: string; nav: string };
};

/**
 * Mobile Drawer Menu styled 1:1 like Testa Toro (Image 2):
 * - Top header bar: Close (X) on right, Centered Logo, Cart Bag & Search icon on left.
 * - Nav links: All identical in font size, elegant dark typography, zero green color.
 *   "الصفحة الرئيسية" has the soft gray active background block exactly like Image 2.
 * - Bottom area: 3 social media icons (TikTok, Instagram, Facebook) centered without login text.
 */
export function MobileMenu({ links, labels }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const { locale, t } = useLocale();
  const { count } = useCart();
  const { data: liveSite } = useLive("settings");
  const close = () => dialogRef.current?.close();

  const liveContacts = liveSite?.settings?.store?.footer_contacts;
  const whatsappUrl = liveContacts?.whatsappUrl || "https://chat.whatsapp.com/EWcBrybFmbr7jbMJUJGSUk?s=sh&p=a&iam=2";
  const tiktokUrl = liveContacts?.tiktokUrl || "https://www.tiktok.com/@terr3hop";
  const instagramUrl = liveContacts?.instagramUrl || "https://www.instagram.com/terr3hop/";
  const facebookUrl = liveContacts?.facebookUrl || "https://www.facebook.com/terrahop.wear";

  return (
    <>
      {/* Burger Menu Button */}
      <button
        ref={openerRef}
        type="button"
        aria-haspopup="dialog"
        aria-label={labels.menu}
        onClick={() => dialogRef.current?.showModal()}
        className="text-current -ml-1 p-2 md:hidden cursor-pointer flex items-center justify-center hover:opacity-80 transition"
      >
        <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
      </button>

      {/* Drawer Dialog - Pure White Background matching Testa Toro */}
      <dialog
        ref={dialogRef}
        dir="rtl"
        aria-label={labels.menu}
        onClose={() => openerRef.current?.focus()}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-white p-0 text-obsidian opacity-0 transition-opacity duration-200 open:opacity-100 starting:open:opacity-0 z-50 backdrop:bg-black/60"
      >
        <div className="flex h-full flex-col bg-white">
          {/* 1. Top Header Bar:
              - Right (in RTL): Close (X)
              - Center: TERRA HOP Logo
              - Left (in RTL): Search + Cart Bag (with items badge)
          */}
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 px-4 sm:px-6 bg-white">
            {/* Right side in RTL: Close Button (X) */}
            <button
              type="button"
              onClick={close}
              aria-label={labels.close}
              className="flex h-10 w-10 items-center justify-center rounded-full text-stone-800 hover:bg-stone-100 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Center: Brand Logo */}
            <Link
              href="/"
              onClick={close}
              aria-label={t.common.brand}
              className="w-24 sm:w-28 text-obsidian flex items-center justify-center transition hover:opacity-80"
            >
              <Logo className="w-full h-auto" />
            </Link>

            {/* Left side in RTL: Cart Bag & Search Icons (matching Testa Toro header) */}
            <div className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/shop"
                onClick={close}
                aria-label={locale === "ar" ? "بحث في المتجر" : "Search shop"}
                className="flex h-10 w-10 items-center justify-center rounded-full text-stone-800 hover:bg-stone-100 transition cursor-pointer"
              >
                <Search className="h-5 w-5" />
              </Link>

              <Link
                href="/cart"
                onClick={close}
                aria-label={t.header.cart}
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-stone-800 hover:bg-stone-100 transition cursor-pointer"
              >
                <ShoppingBag className="h-5 w-5" />
                {count > 0 && (
                  <span className="absolute top-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-obsidian px-1 text-[10px] font-bold text-white tabular-nums">
                    {count}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* 2. Menu Links - Identical font size, sleek typography, zero green color */}
          <nav aria-label={labels.nav} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-1">
            {/* Home Link - Highlighted with soft gray background block matching Testa Toro Image 2 */}
            <Link
              href="/"
              onClick={close}
              className="block rounded bg-stone-100/90 px-4 py-3.5 text-base sm:text-lg font-bold text-stone-900 transition-colors"
            >
              الصفحة الرئيسية
            </Link>

            {/* Shop / Products */}
            <Link
              href="/shop"
              onClick={close}
              className="block rounded px-4 py-3.5 text-base sm:text-lg font-bold text-stone-900 hover:bg-stone-50 transition-colors"
            >
              المتجر
            </Link>

            {/* Secondary navigation items from props */}
            {links
              .filter((l) => l.href !== "/shop")
              .map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={close}
                  className="block rounded px-4 py-3.5 text-base sm:text-lg font-bold text-stone-900 hover:bg-stone-50 transition-colors"
                >
                  {l.label}
                </Link>
              ))}

            {/* Checkout (إتمام الطلب) - EXACT same size and font color as other links, NO green color */}
            <Link
              href="/checkout"
              onClick={close}
              className="block rounded px-4 py-3.5 text-base sm:text-lg font-bold text-stone-900 hover:bg-stone-50 transition-colors"
            >
              إتمام الطلب
            </Link>
          </nav>

          {/* 3. Bottom Bar: Social Media Icons (WhatsApp, TikTok, Instagram, Facebook) */}
          <div className="mt-auto shrink-0 border-t border-stone-200/80 px-6 py-6 flex flex-col items-center justify-center bg-white">
            <div className="flex items-center justify-center gap-6 text-stone-900">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp Group"
                className="flex h-10 w-10 items-center justify-center rounded-full text-stone-900 hover:bg-stone-100 transition"
              >
                <WhatsAppIcon className="h-5 w-5 fill-current" />
              </a>
              <a
                href={tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                className="flex h-10 w-10 items-center justify-center rounded-full text-stone-900 hover:bg-stone-100 transition"
              >
                <TikTokIcon className="h-5 w-5 fill-current" />
              </a>
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="flex h-10 w-10 items-center justify-center rounded-full text-stone-900 hover:bg-stone-100 transition"
              >
                <InstagramIcon className="h-5 w-5 fill-current" />
              </a>
              <a
                href={facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="flex h-10 w-10 items-center justify-center rounded-full text-stone-900 hover:bg-stone-100 transition"
              >
                <FacebookIcon className="h-5 w-5 fill-current" />
              </a>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
