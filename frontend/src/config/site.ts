/**
 * Single source of truth for the public-facing identity of the site.
 *
 * Kept in one place because the same values have to agree across the
 * document <title>, canonical tags, sitemap.xml, the legal pages and the
 * Open Graph image - and a mismatch between any of them is the kind of bug
 * nobody notices until a link preview looks wrong in production.
 *
 * SITE_URL must match the deployed origin exactly (no trailing slash), or
 * canonical tags will point somewhere that 404s.
 */
export const SITE_URL: string = (
  import.meta.env.VITE_SITE_URL || 'https://stock-market-analyser-vert.vercel.app'
).replace(/\/$/, '');

export const SITE_NAME = 'STONKS';
export const SITE_TAGLINE = 'AI Equity Research Platform';

/**
 * TODO(owner): replace with the real operating entity and a monitored inbox
 * before this is treated as a binding legal notice. These strings appear
 * verbatim in the privacy policy, terms, and cookie policy.
 */
export const LEGAL_ENTITY = 'STONKS';
export const CONTACT_EMAIL = 'aadityavijaywargi7@gmail.com';
export const GOVERNING_JURISDICTION = 'India';

/** Last substantive revision of the legal pages. Update when you edit them. */
export const LEGAL_LAST_UPDATED = '16 September 2026';
