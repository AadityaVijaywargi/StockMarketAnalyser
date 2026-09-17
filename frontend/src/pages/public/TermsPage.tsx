import React from 'react';
import { Link } from 'react-router-dom';
import { LegalPage, Section, Bullets } from '../../components/public/LegalPage';
import { SITE_NAME, LEGAL_ENTITY, CONTACT_EMAIL, GOVERNING_JURISDICTION } from '../../config/site';

/**
 * Terms of service.
 *
 * The financial-disclaimer sections carry the real weight here: this is a
 * tool that outputs BUY/WATCH/AVOID-shaped scores and price targets for
 * Indian equities, so the terms have to be unambiguous that it is research
 * software and not advice from a registered adviser.
 *
 * TODO(owner): drafted from the implementation, not by a lawyer. Have this
 * reviewed before relying on it, particularly the liability and jurisdiction
 * clauses, and fill in the real operating entity in config/site.ts.
 */
export const TermsPage: React.FC = () => (
  <LegalPage
    title="Terms of Service"
    description={`The terms governing your use of ${SITE_NAME}, including the limits of what the platform provides and your responsibilities as a user.`}
    canonicalPath="/terms"
  >
    <Section id="acceptance" heading="1. Agreement">
      <p>
        These terms are an agreement between you and <strong>{LEGAL_ENTITY}</strong> covering
        your use of {SITE_NAME}. By requesting access, creating an account, or using the
        service, you accept them. If you do not accept them, do not use {SITE_NAME}.
      </p>
      <p>You must be at least 18 years old and legally able to enter into this agreement.</p>
    </Section>

    <Section id="not-advice" heading="2. Not investment advice">
      <p>
        <strong>
          {SITE_NAME} is a research and educational tool. It is not investment advice, and
          nothing it produces is a recommendation to buy, sell or hold any security.
        </strong>
      </p>
      <p>
        {LEGAL_ENTITY} is not a SEBI-registered investment adviser, research analyst, or
        portfolio manager, and does not provide personalised financial advice. Scores,
        signals, price targets, risk profiles, pattern detections and AI-generated
        commentary are the mechanical output of statistical models applied to historical
        price data. They do not account for your financial position, objectives, tax
        situation or risk tolerance, and they may be wrong.
      </p>
      <p>
        Every investment decision you make is yours alone. Consult a SEBI-registered
        investment adviser before acting on anything you see here.
      </p>
    </Section>

    <Section id="no-guarantee" heading="3. No guarantee of accuracy or performance">
      <Bullets
        items={[
          <>
            <strong>Past performance does not indicate future results.</strong> Backtest
            results are hypothetical, derived from historical data, and were not achieved by
            any real portfolio.
          </>,
          <>
            <strong>Backtests are models, not history.</strong> Even with next-open fills,
            intraday stop checks and cost assumptions applied, a simulation cannot reproduce
            real liquidity, partial fills, order rejection or market impact. Real results
            will differ, usually for the worse.
          </>,
          <>
            <strong>Market data may be delayed, incomplete or wrong.</strong> We source it
            from third parties and cannot guarantee its accuracy or timeliness. Do not rely
            on it for time-sensitive decisions.
          </>,
          <>
            <strong>AI-generated explanations can be wrong.</strong> Narrative commentary is
            produced by a language model and may contain errors or mischaracterise the
            underlying numbers.
          </>,
          <>
            <strong>Trading carries risk of loss.</strong> You can lose some or all of your
            capital.
          </>,
        ]}
      />
    </Section>

    <Section id="accounts" heading="4. Your account">
      <p>
        Access is by invitation. Invite codes are single-use and personal to you; do not share
        them. You are responsible for keeping your password secure and for everything done
        through your account. Tell us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> promptly if you think your
        account has been compromised.
      </p>
      <p>
        You may close your account at any time. We may suspend or terminate an account that
        breaches these terms, or where we reasonably suspect abuse.
      </p>
    </Section>

    <Section id="acceptable-use" heading="5. Acceptable use">
      <p>You agree not to:</p>
      <Bullets
        items={[
          'Scrape, crawl, or systematically extract data from the service, or use automated tools against it beyond normal interactive use.',
          'Resell, redistribute, or publish the output of the service as your own product or as investment advice to others.',
          'Attempt to gain unauthorised access to any account, server or network, or to circumvent rate limits, authentication or other security controls.',
          'Reverse engineer or attempt to derive the source of the scoring models.',
          'Use the service to break any applicable law, including securities and market-manipulation law.',
          'Interfere with the service or place an unreasonable load on its infrastructure.',
        ]}
      />
    </Section>

    <Section id="ip" heading="6. Intellectual property">
      <p>
        The service, its software, models, design and content belong to {LEGAL_ENTITY} and are
        protected by intellectual property law. You get a limited, personal, non-exclusive,
        non-transferable licence to use {SITE_NAME} for your own research while your account
        is active. Underlying market data belongs to its respective providers.
      </p>
      <p>
        Data you enter — your watchlist, trades and alerts — remains yours. You grant us only
        the licence needed to store and display it back to you.
      </p>
    </Section>

    <Section id="availability" heading="7. Availability">
      <p>
        {SITE_NAME} is provided on an <strong>&quot;as is&quot;</strong> and{' '}
        <strong>&quot;as available&quot;</strong> basis, without warranties of any kind,
        express or implied, including merchantability, fitness for a particular purpose, and
        non-infringement. We do not warrant that the service will be uninterrupted,
        error-free, or that defects will be corrected.
      </p>
      <p>
        This is a private beta running on shared infrastructure. Expect downtime, cold starts,
        and changes to features without notice. We may modify or discontinue any part of the
        service at any time.
      </p>
    </Section>

    <Section id="liability" heading="8. Limitation of liability">
      <p>
        To the maximum extent permitted by law, {LEGAL_ENTITY} is not liable for any trading
        or investment losses, lost profits, lost data, or any indirect, incidental, special,
        consequential or punitive damages arising from your use of — or inability to use —{' '}
        {SITE_NAME}, whether or not we were advised such damages were possible.
      </p>
      <p>
        Where liability cannot lawfully be excluded, our total aggregate liability to you is
        limited to the greater of the amount you paid us in the twelve months before the claim
        (which, during the free beta, is nil) or INR 1,000.
      </p>
      <p>
        Nothing in these terms excludes liability for fraud, or for anything else that cannot
        be excluded under applicable law.
      </p>
    </Section>

    <Section id="indemnity" heading="9. Indemnity">
      <p>
        You agree to indemnify {LEGAL_ENTITY} against claims, losses and reasonable legal costs
        arising from your breach of these terms, your misuse of the service, or your
        redistribution of its output to third parties.
      </p>
    </Section>

    <Section id="privacy" heading="10. Privacy">
      <p>
        Our handling of personal data is described in the{' '}
        <Link to="/privacy">Privacy Policy</Link>, and our use of browser storage in the{' '}
        <Link to="/cookies">Cookie Policy</Link>. Both form part of these terms.
      </p>
    </Section>

    <Section id="changes" heading="11. Changes to these terms">
      <p>
        We may update these terms. The revision date at the top of this page always reflects
        the current version, and we will notify account holders by email of material changes.
        Continuing to use {SITE_NAME} after a change means you accept the updated terms.
      </p>
    </Section>

    <Section id="law" heading="12. Governing law">
      <p>
        These terms are governed by the laws of {GOVERNING_JURISDICTION}, and the courts of{' '}
        {GOVERNING_JURISDICTION} have exclusive jurisdiction over any dispute arising from
        them. If any provision is found unenforceable, the rest remains in force.
      </p>
    </Section>

    <Section id="contact" heading="13. Contact">
      <p>
        Questions about these terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </Section>
  </LegalPage>
);

export default TermsPage;
