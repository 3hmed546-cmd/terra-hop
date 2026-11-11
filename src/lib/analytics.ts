export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || "G-KZYGTPH51P";

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Log standard or custom event to Google Analytics (GA4)
 */
export function trackEvent(action: string, params?: Record<string, any>) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", action, params);
  }
}

/**
 * Track page view manually if needed
 */
export function trackPageView(url: string) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("config", GA_MEASUREMENT_ID, {
      page_path: url,
    });
  }
}
