import React from 'react';
import { Link } from 'react-router-dom';
import { LegalPage, Section } from '../../components/public/LegalPage';
import { SITE_NAME, CONTACT_EMAIL } from '../../config/site';

/**
 * Cookie policy.
 *
 * The honest position, verified against the code: this app sets no cookies
 * at all (there is no `document.cookie` write anywhere in src/), and the
 * analytics provider is cookieless. What it does use is localStorage, which
 * most "cookie policies" quietly ignore even though the ePrivacy rules on
 * terminal-equipment storage cover it identically.
 *
 * That is also why there is no consent banner: every key below is strictly
 * necessary for a feature the user explicitly asked for, which is the exact
 * exemption that removes the consent requirement. If a cookie-based or
 * otherwise non-exempt tracker is ever added, a real opt-in banner has to
 * land in the same change - not this page alone.
 */

const STORAGE_KEYS: Array<{ key: string; purpose: string; life: string }> = [
  {
    key: 'stonks_auth_token',
    purpose: 'Keeps you signed in. Without it you would have to re-enter your password on every page.',
    life: 'Until you sign out or the session expires',
  },
  {
    key: 'stonks_auth_username / stonks_auth_role',
    purpose: 'Shows your name in the interface and determines which admin controls to render.',
    life: 'Until you sign out',
  },
  {
    key: 'stonks_watchlist / stonks_active_trades / stonks_completed_trades / stonks_price_alerts',
    purpose: 'A local copy of the watchlist, trades and alerts you created, so the app works instantly and keeps functioning if the backend is briefly unavailable.',
    life: 'Until you delete the items or clear browser storage',
  },
  {
    key: 'stonks_settings / stonks_chart_indicators / stonks_user_chart_drawings / stonks_chartpage_watchlist_open',
    purpose: 'Remembers your display preferences, chosen chart indicators, drawings and panel layout between visits.',
    life: 'Until you change them or clear browser storage',
  },
  {
    key: 'recent_searches',
    purpose: 'Lists the last five tickers you looked at so you can jump back to them.',
    life: 'Until cleared; holds at most five entries',
  },
  {
    key: 'stonks_pinned_notifications and *_updated keys',
    purpose: 'Tracks which alerts you pinned and lets open tabs notice each other’s changes so the interface stays in sync.',
    life: 'Until cleared',
  },
];

export const CookiePolicyPage: React.FC = () => (
  <LegalPage
    title="Cookie Policy"
    description={`${SITE_NAME} sets no cookies and uses no advertising trackers. This page explains the browser storage the app does use and why it needs no consent banner.`}
    canonicalPath="/cookies"
  >
    <Section id="summary" heading="1. The short version">
      <p>
        <strong>{SITE_NAME} does not set any cookies.</strong> There are no advertising
        cookies, no third-party tracking cookies, and no cross-site profiling of any kind.
      </p>
      <p>
        What the app does use is <strong>local storage</strong> in your own browser, to keep
        you signed in and to remember what you created and how you like things arranged. That
        data stays on your device. It is not a cookie, it is never sent automatically with
        requests, and we cannot read it from any other website.
      </p>
    </Section>

    <Section id="no-banner" heading="2. Why there is no consent banner">
      <p>
        Consent is required for storage that is not necessary for a service you explicitly
        asked for — advertising, cross-site tracking, and analytics that identify you. We use
        none of those.
      </p>
      <p>
        Every item we store is strictly necessary for a feature you are actively using: your
        session, your watchlist, your alerts, your settings. That falls within the
        strictly-necessary exemption, so a consent banner would be asking you to agree to
        something that needs no agreement — and training people to dismiss consent prompts
        without reading them does not make anybody more private.
      </p>
      <p>
        If we ever add a tracker that genuinely requires consent, we will add a real opt-in
        banner at the same time, and nothing non-essential will load until you accept.
      </p>
    </Section>

    <Section id="what" heading="3. What we store, exactly">
      <p>The complete list of what {SITE_NAME} writes to your browser:</p>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[520px] text-xs border-collapse">
          <caption className="sr-only">
            Browser storage keys used by {SITE_NAME}, their purpose, and how long they last
          </caption>
          <thead>
            <tr className="border-b border-borderDark">
              <th scope="col" className="text-left font-semibold text-white py-2.5 pr-4 align-bottom">
                Key
              </th>
              <th scope="col" className="text-left font-semibold text-white py-2.5 pr-4 align-bottom">
                What it is for
              </th>
              <th scope="col" className="text-left font-semibold text-white py-2.5 align-bottom">
                How long it lasts
              </th>
            </tr>
          </thead>
          <tbody>
            {STORAGE_KEYS.map(row => (
              <tr key={row.key} className="border-b border-borderDark/60 align-top">
                <td className="py-3 pr-4 font-mono text-[11px] text-brandText break-words">{row.key}</td>
                <td className="py-3 pr-4 leading-relaxed">{row.purpose}</td>
                <td className="py-3 leading-relaxed">{row.life}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>

    <Section id="analytics" heading="4. Analytics">
      <p>
        We measure aggregate traffic using a <strong>cookieless</strong> analytics provider.
        It records that a page was viewed, which page, and roughly where the visit came from
        (referring site, country, browser and device type). It sets no cookies, assigns no
        persistent identifier, and does not follow you across other websites.
      </p>
      <p>
        We cannot use it to identify you, and there is no profile of your activity to opt out
        of. If you would still rather not be counted, any browser-level tracker blocker or
        Do Not Track setting will prevent the script from loading, and the site works
        identically without it.
      </p>
    </Section>

    <Section id="control" heading="5. How to clear it">
      <p>
        Signing out removes your session data immediately. To remove everything, clear site
        data for this domain in your browser settings — usually under Privacy, then Cookies
        and site data. Your account, and anything already synced to it, is unaffected;
        deleting that is covered in the <Link to="/privacy">Privacy Policy</Link>.
      </p>
      <p>
        Blocking local storage entirely will prevent you from staying signed in, because the
        session token has nowhere to live.
      </p>
    </Section>

    <Section id="contact" heading="6. Contact">
      <p>
        Questions about any of this: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </Section>
  </LegalPage>
);

export default CookiePolicyPage;
