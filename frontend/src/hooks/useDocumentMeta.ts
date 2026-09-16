import { useEffect } from 'react';
import { SITE_NAME, SITE_URL } from '../config/site';

/**
 * Per-route <title>, meta description and canonical URL.
 *
 * This is a client-side SPA, so these are set after hydration. Search
 * engines execute JS and will see them; most social scrapers do not, which
 * is why the Open Graph tags for link previews stay static in index.html
 * (the marketing page at "/" is the page people actually share).
 *
 * A dedicated helmet library would do the same job with a larger bundle and
 * a provider wrapper, which this app has no other use for.
 */
interface DocumentMeta {
  title: string;
  description?: string;
  /** Path only, e.g. "/privacy". Defaults to the current location. */
  canonicalPath?: string;
  /** Keep search engines out of pages with no standalone search value. */
  noIndex?: boolean;
}

const setMetaTag = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

export const useDocumentMeta = ({ title, description, canonicalPath, noIndex }: DocumentMeta): void => {
  useEffect(() => {
    // Titles that already lead with the brand (the home page) are used as-is.
    const fullTitle = title.startsWith(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;
    document.title = fullTitle;

    if (description) {
      setMetaTag('meta[name="description"]', 'name', 'description', description);
      setMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
    }
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', fullTitle);

    const path = canonicalPath ?? window.location.pathname;
    const canonicalUrl = `${SITE_URL}${path === '/' ? '/' : path.replace(/\/$/, '')}`;

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonicalUrl);
    setMetaTag('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);

    // Gated pages are crawlable URLs that render nothing useful to a
    // logged-out crawler, so they are explicitly excluded rather than left
    // to be indexed as near-empty duplicates of the login screen.
    const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (noIndex) {
      setMetaTag('meta[name="robots"]', 'name', 'robots', 'noindex, nofollow');
    } else if (robots) {
      robots.remove();
    }
  }, [title, description, canonicalPath, noIndex]);
};
