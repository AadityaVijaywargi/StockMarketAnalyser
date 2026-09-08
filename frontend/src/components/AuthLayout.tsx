import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, LineChart, Bell, ShieldCheck, GitCompare } from 'lucide-react';

const FEATURES = [
  { icon: LineChart, title: 'Deterministic quant scoring', desc: 'Trend, momentum, volume, and risk blended into one transparent score.' },
  { icon: Bell, title: 'Live price alerts', desc: 'Get notified the moment a stock crosses your target, wherever you are in the app.' },
  { icon: GitCompare, title: 'Side-by-side comparison', desc: 'Weigh up to four stocks on score, risk, and target in one view.' },
  { icon: ShieldCheck, title: 'Your data, synced', desc: 'Watchlist and trades follow your account across devices.' },
];

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen w-full bg-background relative flex items-stretch overflow-hidden font-sans select-none">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#141414_1px,transparent_1px),linear-gradient(to_bottom,#141414_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-70 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-brand/5 rounded-full filter blur-[140px] pointer-events-none" />

      {/* Left branding panel - desktop only */}
      <div className="hidden lg:flex flex-col justify-center w-1/2 max-w-xl px-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center shadow-lg shadow-brand/20">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-wider text-white">STONKS</h1>
              <p className="text-[9px] text-textMuted tracking-wider font-mono uppercase">AI Equity Research</p>
            </div>
          </div>

          <h2 className="text-3xl font-extrabold text-white tracking-tight leading-tight mb-3">
            Institution-grade research,<br />built for your own portfolio.
          </h2>
          <p className="text-sm text-textMuted mb-10 max-w-md">
            A private, invite-only research platform for NSE &amp; BSE stocks — quantitative scoring, live signals, and portfolio tracking in one place.
          </p>

          <div className="flex flex-col gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
                  className="flex items-start gap-3.5"
                >
                  <div className="w-9 h-9 rounded-lg bg-white/[0.03] border border-borderDark flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-brand" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{f.title}</h3>
                    <p className="text-xs text-textMuted mt-0.5">{f.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
        {children}
      </div>
    </div>
  );
};

export default AuthLayout;
