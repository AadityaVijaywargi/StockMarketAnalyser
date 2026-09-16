import React from 'react';
import { Link } from 'react-router-dom';
import { LegalPage, Section, Bullets } from '../../components/public/LegalPage';
import { SITE_NAME, LEGAL_ENTITY, CONTACT_EMAIL, GOVERNING_JURISDICTION } from '../../config/site';

/**
 * Privacy policy.
 *
 * Every claim here is written to match what the code actually does - the
 * fields api/user_store.py persists, the keys api/user_data_store.py syncs,
 * the localStorage keys the frontend writes, and the two third parties the
 * backend talks to (Yahoo Finance for prices, Google Gemini for narrative
 * explanations). If any of those change, this page has to change with them.
 *
 * TODO(owner): this is drafted from the implementation, not by a lawyer.
 * Have it reviewed before relying on it as a binding notice, and fill in the
 * real operating entity in config/site.ts.
 */
export const PrivacyPolicyPage: React.FC = () => (
  <LegalPage
    title="Privacy Policy"
    description={`How ${SITE_NAME} collects, uses, stores and protects your personal data, and the rights you have over it.`}
    canonicalPath="/privacy"
  >
    <Section id="intro" heading="1. Who we are">
      <p>
        {SITE_NAME} is an invite-only equity research platform for the Indian stock market,
        operated by <strong>{LEGAL_ENTITY}</strong>. This policy explains what personal data
        we collect when you use the service, why we collect it, how long we keep it, and what
        you can ask us to do with it.
      </p>
      <p>
        It applies to this website and the {SITE_NAME} application. If you do not agree with
        it, please do not request access. Questions go to{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </Section>

    <Section id="collect" heading="2. What we collect">
      <p>
        <strong>When you request access.</strong> Your email address and anything you choose
        to write in the optional message field. We use this only to decide whether to issue an
        invite and to email you the outcome.
      </p>
      <p>
        <strong>When you create an account.</strong> A username, an email address, and a
        password. The password is never stored: we keep only a salted PBKDF2 hash of it, which
        cannot be reversed back into your password.
      </p>
      <p>
        <strong>What you create while using the service.</strong> Your watchlist, recorded
        trades and price alerts, if you are signed in and they sync to your account.
      </p>
      <p>
        <strong>Automatically.</strong> Server logs containing your IP address, the request
        path and a timestamp. We use IP addresses for a single purpose: rate-limiting login
        and sign-up attempts so the service cannot be brute-forced.
      </p>
      <p>
        <strong>What we never collect.</strong> We do not ask for and do not store payment
        details, PAN, Aadhaar, demat or broker account numbers, bank details, or any
        holdings you have not manually entered yourself. {SITE_NAME} has no connection to
        any broker and cannot place trades.
      </p>
    </Section>

    <Section id="why" heading="3. Why we use it, and on what basis">
      <Bullets
        items={[
          <>
            <strong>To provide the service</strong> — authenticating you, and storing the
            watchlist, trades and alerts you create. This is necessary to perform our
            agreement with you.
          </>,
          <>
            <strong>To keep the service secure</strong> — rate-limiting authentication
            attempts and investigating abuse. This is our legitimate interest in preventing
            unauthorised access to your account.
          </>,
          <>
            <strong>To administer invites</strong> — reviewing access requests and issuing
            codes. This is our legitimate interest in running a private beta, and your
            consent in submitting the request.
          </>,
          <>
            <strong>To understand aggregate usage</strong> — privacy-preserving analytics
            that count page views without identifying you. See our{' '}
            <Link to="/cookies">Cookie Policy</Link>.
          </>,
        ]}
      />
      <p>
        We do not sell your personal data, we do not share it with advertisers, and we do not
        use it to build advertising or behavioural profiles.
      </p>
    </Section>

    <Section id="storage" heading="4. Where it is stored">
      <p>
        Account data is held in a managed PostgreSQL database. The application is hosted on
        Vercel (frontend) and Render (backend). These providers process data on our behalf
        under their own security commitments, and may store or process it outside{' '}
        {GOVERNING_JURISDICTION}. Passwords are stored only as salted PBKDF2 hashes, and all
        traffic to the service is encrypted in transit over HTTPS.
      </p>
      <p>
        Some information is kept in your own browser rather than on our servers — your session
        token, your recent searches and your display preferences. That data never leaves your
        device unless you are signed in and it syncs to your account. Clearing your browser
        storage removes it.
      </p>
    </Section>

    <Section id="third-parties" heading="5. Third parties we rely on">
      <Bullets
        items={[
          <>
            <strong>Market data providers</strong> — we fetch historical and live price data
            from public market data sources. These requests are made by our server and carry
            no information about you.
          </>,
          <>
            <strong>Google Gemini</strong> — used to generate the narrative explanation
            accompanying an analysis. We send the ticker symbol and computed indicator values.
            We do not send your name, email, username, watchlist or trades.
          </>,
          <>
            <strong>Vercel and Render</strong> — hosting providers, which necessarily process
            connection metadata such as your IP address in order to serve requests.
          </>,
          <>
            <strong>Analytics</strong> — a cookieless, privacy-preserving analytics provider
            that records aggregate page views without cookies or personal identifiers.
          </>,
        ]}
      />
    </Section>

    <Section id="retention" heading="6. How long we keep it">
      <Bullets
        items={[
          <>
            <strong>Account data</strong> — for as long as your account exists, and deleted
            when you ask us to close it.
          </>,
          <>
            <strong>Watchlist, trades and alerts</strong> — until you delete them, or until
            your account is closed.
          </>,
          <>
            <strong>Access requests that we decline</strong> — deleted within 12 months.
          </>,
          <>
            <strong>Server logs</strong> — retained for a short operational window and then
            rotated out. Rate-limiting records are held in memory only and expire within an
            hour.
          </>,
        ]}
      />
    </Section>

    <Section id="rights" heading="7. Your rights">
      <p>
        Under {GOVERNING_JURISDICTION}&apos;s Digital Personal Data Protection Act, 2023 — and
        under the GDPR if you are in the EU or UK — you can ask us to:
      </p>
      <Bullets
        items={[
          'Give you a copy of the personal data we hold about you.',
          'Correct anything that is inaccurate or incomplete.',
          'Delete your account and the personal data attached to it.',
          'Withdraw a consent you previously gave, at any time.',
          'Nominate someone to exercise these rights on your behalf if you cannot.',
          'Complain to a data protection authority if you think we have got this wrong.',
        ]}
      />
      <p>
        Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> to exercise any of
        these. We aim to respond within 30 days, and we will not charge you for it.
      </p>
    </Section>

    <Section id="security" heading="8. Security">
      <p>
        We hash passwords with salted PBKDF2, serve everything over HTTPS with HSTS, restrict
        which origins may call our API, rate-limit authentication attempts, and scope session
        tokens so they expire. No system is perfectly secure, and we cannot guarantee
        absolute security — but if a breach affects your personal data, we will tell you and
        the relevant authority without undue delay.
      </p>
    </Section>

    <Section id="children" heading="9. Children">
      <p>
        {SITE_NAME} is not intended for anyone under 18, and we do not knowingly collect data
        from children. If you believe a child has given us personal data, contact us and we
        will delete it.
      </p>
    </Section>

    <Section id="changes" heading="10. Changes to this policy">
      <p>
        If we change how we handle personal data, we will update this page and revise the date
        at the top. Material changes will be notified to account holders by email. Continuing
        to use {SITE_NAME} after a change means you accept the updated policy.
      </p>
    </Section>

    <Section id="contact" heading="11. Contact">
      <p>
        For anything in this policy, including data access and deletion requests, write to{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </Section>
  </LegalPage>
);

export default PrivacyPolicyPage;
