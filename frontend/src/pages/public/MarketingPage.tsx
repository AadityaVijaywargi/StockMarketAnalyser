import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LineChart, Bell, GitCompare, ShieldCheck, Activity, FlaskConical, ArrowRight, Lock } from 'lucide-react';
import { PublicLayout } from '../../components/public/PublicLayout';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { SITE_NAME } from '../../config/site';

/**
 * The public landing page - the only page a logged-out visitor or a search
 * crawler sees by default.
 *
 * Note this is NOT the old LandingPage, which is the authenticated app home
 * (search bar, recent searches, live opportunities) and now lives at /app.
 * Nothing here calls the API: the page must render fully for someone with no
 * account, and the backend is a free-tier instance that cold-starts.
 *
 * It also deliberately shows no market numbers. The previous landing page
 * carried hardcoded placeholder index values, which are harmless behind a
 * login but would be fabricated market data on a public finance page.
 */

const FEATURES = [
  {
    icon: LineChart,
    title: 'Deterministic scoring',
    desc: 'Trend, momentum, volume and volatility combine into one transparent score. Same inputs, same output, every time - no black box.',
  },
  {
    icon: Activity,
    title: 'Live charting & patterns',
    desc: 'Candlestick charts with indicator overlays, automatic support and resistance zones, and detected chart patterns.',
  },
  {
    icon: FlaskConical,
    title: 'Honest backtesting',
    desc: 'Next-open fills, intraday stop checks, and brokerage and slippage costs applied - so results resemble what actually fills.',
  },
  {
    icon: Bell,
    title: 'Price alerts',
    desc: 'Set a target and get notified the moment a stock crosses it, anywhere in the app.',
  },
  {
    icon: GitCompare,
    title: 'Side-by-side comparison',
    desc: 'Weigh up to four stocks on score, risk profile and target in a single view.',
  },
  {
    icon: ShieldCheck,
    title: 'Synced to your account',
    desc: 'Watchlist, trades and alerts follow you across devices, backed by a real database.',
  },
];

const STEPS = [
  { n: '01', title: 'Request access', desc: 'Tell us who you are. Access is invite-only while the platform is in private beta.' },
  { n: '02', title: 'Get your invite', desc: 'We review requests by hand and email you a single-use invite code.' },
  { n: '03', title: 'Start researching', desc: 'Search any NSE or BSE ticker and get a full quantitative breakdown in seconds.' },
];

export const MarketingPage: React.FC = () => {
  useDocumentMeta({
    title: `${SITE_NAME} — AI Equity Research for NSE & BSE`,
    description:
      'Private, invite-only equity research for Indian markets. Deterministic technical scoring, live charting, pattern detection, cost-aware backtesting and price alerts for NSE and BSE stocks.',
    canonicalPath: '/',
  });

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_right,#141414_1px,transparent_1px),linear-gradient(to_bottom,#141414_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-70 pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] max-w-full h-[300px] bg-brand/5 rounded-full blur-[120px] pointer-events-none"
        />

        <div className="relative max-w-3xl mx-auto px-5 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-6"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-borderDark text-[11px] font-semibold tracking-wider text-brandText font-mono uppercase">
              <Lock className="w-3 h-3" aria-hidden="true" />
              Invite-only private beta
            </span>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05]">
              Institution-grade equity
              <br className="hidden sm:block" />{' '}
              research for Indian markets
            </h1>

            <p className="text-sm sm:text-base text-textMuted max-w-xl leading-relaxed">
              {SITE_NAME} turns NSE and BSE price data into a transparent, reproducible
              view of a stock — quantitative scoring, pattern detection, support and
              resistance, and cost-aware backtests. Built for people who want to see the
              working, not just the verdict.
            </p>

            {/* The single primary call to action on the site. */}
            <div className="flex flex-col sm:flex-row items-center gap-3 mt-2 w-full sm:w-auto">
              <Link
                to="/request-access"
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand hover:brightness-110 text-white font-bold text-sm transition-all shadow-lg shadow-brand/20"
              >
                Request access
                <ArrowRight
                  className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-xl border border-borderDark hover:border-white/20 text-textMuted hover:text-white font-semibold text-sm transition-all"
              >
                I already have an invite
              </Link>
            </div>

            <p className="text-xs text-textMuted">Free during the beta. No card required.</p>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section aria-labelledby="features-heading" className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-20">
        <h2 id="features-heading" className="text-2xl sm:text-3xl font-black tracking-tight text-center mb-3">
          What you get
        </h2>
        <p className="text-sm text-textMuted text-center max-w-xl mx-auto mb-12">
          Every number is computed from price and volume data you can check yourself.
        </p>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <li
                key={f.title}
                className="rounded-2xl border border-borderDark bg-surface p-5 flex flex-col gap-3"
              >
                <span className="w-10 h-10 rounded-xl bg-white/[0.03] border border-borderDark flex items-center justify-center">
                  <Icon className="w-[18px] h-[18px] text-brandText" aria-hidden="true" />
                </span>
                <h3 className="text-sm font-bold">{f.title}</h3>
                <p className="text-xs text-textMuted leading-relaxed">{f.desc}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* How access works */}
      <section aria-labelledby="access-heading" className="border-y border-borderDark bg-surface/30">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-20">
          <h2 id="access-heading" className="text-2xl sm:text-3xl font-black tracking-tight text-center mb-12">
            How access works
          </h2>
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map(step => (
              <li key={step.n} className="flex flex-col gap-2.5">
                <span className="text-xs font-mono font-bold text-brandText tracking-widest">{step.n}</span>
                <h3 className="text-base font-bold">{step.title}</h3>
                <p className="text-xs text-textMuted leading-relaxed">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing CTA - same destination as the hero, deliberately not a second
          competing action. */}
      <section className="max-w-3xl mx-auto px-5 sm:px-6 py-16 sm:py-24 text-center flex flex-col items-center gap-5">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Ready to look under the hood?</h2>
        <p className="text-sm text-textMuted max-w-md">
          Requests are reviewed by hand, usually within a couple of days.
        </p>
        <Link
          to="/request-access"
          className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand hover:brightness-110 text-white font-bold text-sm transition-all shadow-lg shadow-brand/20"
        >
          Request access
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </section>
    </PublicLayout>
  );
};

export default MarketingPage;
