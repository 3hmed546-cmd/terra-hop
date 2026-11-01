import localFont from "next/font/local";

// Self-hosted, Latin subset, variable. Files live in src/fonts (OFL licenses beside them).
// Archivo has a width axis (62% to 125%), used for display sizes only.
export const archivo = localFont({
  src: "../fonts/archivo-latin-wdth-normal.woff2",
  weight: "100 900",
  variable: "--font-archivo",
  display: "swap",
  preload: true,
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

// Not preloaded: only the Archivo file used above the fold is preloaded (v3 Section 4.6).
export const inter = localFont({
  src: "../fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
  preload: false,
});
