/**
 * Cookieless analytics (Umami).
 *
 * Umami sets no cookies and stores no personal identifiers, which is what
 * lets the site run without a consent banner - see pages/public/
 * CookiePolicyPage.tsx. Swapping in a cookie-based tool (GA4 etc.) would
 * break that and require a real opt-in banner in the same change.
 *
 * Does nothing unless VITE_UMAMI_WEBSITE_ID is set, and never runs in dev,
 * so local work and preview deploys do not pollute the numbers. Umami picks
 * up client-side route changes on its own via the History API.
 */

declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, string | number>) => void };
  }
}

const WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined;
const SCRIPT_SRC = (import.meta.env.VITE_UMAMI_SRC as string | undefined) || 'https://cloud.umami.is/script.js';

export const initAnalytics = (): void => {
  if (!import.meta.env.PROD || !WEBSITE_ID || typeof document === 'undefined') return;
  if (document.querySelector('script[data-website-id]')) return;

  const script = document.createElement('script');
  script.defer = true;
  script.src = SCRIPT_SRC;
  script.dataset.websiteId = WEBSITE_ID;
  // Honour the browser's Do Not Track setting.
  script.dataset.doNotTrack = 'true';
  // Only count the production host, not Vercel preview URLs.
  script.dataset.domains = window.location.hostname;
  document.head.appendChild(script);
};

/** Records a named conversion event. Safe to call when analytics is off. */
export const trackEvent = (event: string, data?: Record<string, string | number>): void => {
  try {
    window.umami?.track(event, data);
  } catch {
    // Analytics must never break the page.
  }
};
