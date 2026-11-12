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
  metadataBase: new URL("https://terra-hop.com"),
  title: {
    default: "TERRA HOP | تيرا هوب - براند ستريت وير مصري",
    template: "%s | TERRA HOP - تيرا هوب",
  },
  description:
    "TERRA HOP (تيرا هوب) براند مصري رائد في الستريت وير الأوفر سايز للشباب في مصر. تشكيلات فريدة وخامات قطن فاخرة وإصدارات محدودة بحجز مسبق. Higher on Purpose.",
  keywords: [
    "تيرا هوب",
    "تيراهوب",
    "terra hop",
    "terrahop",
    "براند تيرا هوب",
    "ستريت وير مصري",
    "streetwear egypt",
    "ملابس اوفر سايز",
    "oversized hoodie egypt",
    "هودي اوفر سايز",
    "براند ملابس مصري للشباب",
    "ملابس شبابية مصر",
  ],
  authors: [{ name: "TERRA HOP" }],
  creator: "TERRA HOP",
  publisher: "TERRA HOP",
  applicationName: "TERRA HOP",
  formatDetection: {
    telephone: false,
  },
  alternates: {
    canonical: "https://terra-hop.com",
  },
  openGraph: {
    title: "TERRA HOP | تيرا هوب - براند ستريت وير مصري",
    description:
      "TERRA HOP (تيرا هوب) براند مصري رائد في الستريت وير الأوفر سايز للشباب في مصر. Higher on Purpose.",
    url: "https://terra-hop.com",
    siteName: "TERRA HOP - تيرا هوب",
    locale: "ar_EG",
    type: "website",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "TERRA HOP - تيرا هوب",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TERRA HOP | تيرا هوب - براند ستريت وير مصري",
    description: "براند مصري رائد في الستريت وير الأوفر سايز للشباب في مصر.",
    images: ["/icon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
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

const brandJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://terra-hop.com/#organization",
      name: "TERRA HOP",
      alternateName: ["تيرا هوب", "تيراهوب", "Terra Hop", "terra-hop"],
      url: "https://terra-hop.com",
      logo: "https://terra-hop.com/icon.png",
      sameAs: [
        "https://www.tiktok.com/@teera.hop",
        "https://www.instagram.com/terr3hop/",
        "https://www.facebook.com/terrahop.wear",
      ],
      contactPoint: {
        "@type": "ContactPoint",
        email: "support@terra-hop.com",
        contactType: "customer service",
        areaServed: "EG",
        availableLanguage: ["Arabic", "English"],
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://terra-hop.com/#website",
      url: "https://terra-hop.com",
      name: "TERRA HOP - تيرا هوب",
      alternateName: ["تيرا هوب", "Terra Hop"],
      description: "براند مصري للملابس الستريت وير الأوفر سايز للشباب في مصر",
      publisher: {
        "@id": "https://terra-hop.com/#organization",
      },
      inLanguage: ["ar-EG", "en-US"],
    },
  ],
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
        {/* Google Tag (gtm.js / GTM-TBQL5NFR) */}
        <script async src="https://www.googletagmanager.com/gtm.js?id=GTM-TBQL5NFR" />
        <script
          id="google-tag-init"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-KZYGTPH51P', {
                page_path: window.location.pathname,
              });
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(brandJsonLd) }}
        />
      </head>
      <body className="min-h-dvh">
        {/* Google Tag Manager (noscript fallback) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-TBQL5NFR"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
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
