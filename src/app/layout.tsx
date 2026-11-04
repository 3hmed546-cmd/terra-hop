import type { Metadata, Viewport } from "next";
import { archivo, inter } from "./fonts";
import { MotionProvider } from "@/components/motion/motion-provider";
import { CartProvider } from "@/lib/cart";
import { LocaleProvider } from "@/lib/locale-context";
import { SkipLink } from "@/components/ui/skip-link";
import { uiStrings } from "@/lib/ui-strings";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: uiStrings.document.title, template: `%s | ${uiStrings.document.title}` },
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon-192.png",
  },
};

// Keep the layout viewport tied to the actual device width, including small phones.
// Declaring this explicitly protects the store from platform or proxy defaults that
// can otherwise render a desktop-width layout viewport on mobile browsers.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="ltr" className={`${archivo.variable} ${inter.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh">
        <SkipLink />
        <LocaleProvider>
          <MotionProvider>
            <CartProvider>{children}</CartProvider>
          </MotionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
