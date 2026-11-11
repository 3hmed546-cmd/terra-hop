import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { archivo, inter } from "./fonts";
import { MotionProvider } from "@/components/motion/motion-provider";
import { CartProvider } from "@/lib/cart";
import { LocaleProvider } from "@/lib/locale-context";
import { SkipLink } from "@/components/ui/skip-link";
import { StorefrontGate } from "@/components/storefront/StorefrontGate";
import { uiStrings } from "@/lib/ui-strings";
import { GA_MEASUREMENT_ID } from "@/lib/analytics";
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
        {/* Google Analytics (GA4) */}
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}', {
                  page_path: window.location.pathname,
                });
              `}
            </Script>
          </>
        )}
        <SkipLink />
        <LocaleProvider>
          <MotionProvider>
            <CartProvider>
              <StorefrontGate>{children}</StorefrontGate>
            </CartProvider>
          </MotionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
