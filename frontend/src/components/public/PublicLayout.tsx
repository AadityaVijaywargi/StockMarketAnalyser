import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { SITE_NAME, SITE_TAGLINE, LEGAL_ENTITY, CONTACT_EMAIL } from '../../config/site';

/**
 * Chrome for every logged-out page (marketing, legal, request access, 404).
 *
 * Deliberately separate from the authenticated app shell: this renders no
 * sidebar, no notification rail, and pulls in none of the charting or
 * analysis code, so a first-time visitor downloads a small page rather than
 * the whole application.
 */

const FOOTER_LINKS = [
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms of Service' },
  { to: '/cookies', label: 'Cookie Policy' },
];

interface PublicLayoutProps {
  children: React.ReactNode;
  /** Hides the header CTA on the page the CTA points at. */
  hideCta?: boolean;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children, hideCta }) => {
  return (
    <div className="min-h-screen bg-background text-white font-sans flex flex-col">
      {/* Keyboard and screen-reader users can jump the nav instead of tabbing
          through it on every page. Visible only while focused. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-brand focus:text-white focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>

      <header className="border-b border-borderDark sticky top-0 z-40 bg-background/90 backdrop-blur-md">
        <nav
          aria-label="Primary"
          className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between gap-4"
        >
          <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label={`${SITE_NAME} home`}>
            <span className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center shadow-lg shadow-brand/20">
              <TrendingUp className="w-[18px] h-[18px] text-white" aria-hidden="true" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-bold text-base tracking-wider">{SITE_NAME}</span>
              <span className="hidden sm:block text-[9px] text-textMuted tracking-wider font-mono uppercase mt-0.5">
                {SITE_TAGLINE}
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <NavLink
              to="/login"
              className="px-2.5 sm:px-3 py-2 rounded-lg text-sm font-semibold text-textMuted hover:text-white transition-colors whitespace-nowrap"
            >
              Sign in
            </NavLink>
            {!hideCta && (
              <Link
                to="/request-access"
                data-umami-event="cta-request-access"
                data-umami-event-location="header"
                className="px-3.5 sm:px-4 py-2 rounded-lg bg-brand hover:brightness-110 text-white text-sm font-bold transition-all whitespace-nowrap"
              >
                <span className="sm:hidden">Get access</span>
                <span className="hidden sm:inline">Request access</span>
              </Link>
            )}
          </div>
        </nav>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-borderDark mt-16">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10 flex flex-col gap-6">
          <p className="text-xs text-textMuted leading-relaxed max-w-3xl">
            <strong className="text-white font-semibold">Not investment advice.</strong>{' '}
            {SITE_NAME} is a research and educational tool. Nothing on this site is a
            recommendation to buy or sell any security. Scores, signals and backtests are
            model output based on historical data, may be wrong, and past performance does
            not indicate future results. Markets carry risk of loss. Consult a SEBI-registered
            investment adviser before acting on anything you read here.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 border-t border-borderDark">
            <p className="text-xs text-textMuted">
              © {new Date().getFullYear()} {LEGAL_ENTITY}. All rights reserved.
            </p>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {FOOTER_LINKS.map(link => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="inline-flex items-center min-h-[24px] py-1 text-xs text-textMuted hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="inline-flex items-center min-h-[24px] py-1 text-xs text-textMuted hover:text-white transition-colors"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
