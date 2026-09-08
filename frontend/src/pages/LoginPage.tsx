import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Loader2, AlertCircle, TrendingUp } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: string })?.from || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(detail || 'Login failed. Check your username and password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background relative flex items-center justify-center overflow-hidden font-sans select-none px-6">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#141414_1px,transparent_1px),linear-gradient(to_bottom,#141414_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-70 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-brand/5 rounded-full filter blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm bg-surface border border-borderDark rounded-2xl shadow-premium p-7 flex flex-col gap-6 relative z-10"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-11 h-11 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-brand" />
          </div>
          <h1 className="font-extrabold text-lg text-white font-mono tracking-tight">STONKS</h1>
          <p className="text-xs text-textMuted">Sign in to access the research platform</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-textMuted font-mono uppercase tracking-wider">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              className="px-3.5 py-2.5 rounded-xl bg-background border border-borderDark focus:border-brand/60 outline-none text-sm text-white font-mono transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-textMuted font-mono uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="px-3.5 py-2.5 rounded-xl bg-background border border-borderDark focus:border-brand/60 outline-none text-sm text-white font-mono transition-all"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-bearish/10 border border-bearish/30 text-bearish text-xs font-mono">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !username || !password}
            className="flex items-center justify-center gap-2 mt-1 px-4 py-2.5 rounded-xl bg-brand text-black font-bold text-sm font-mono transition-all hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            <span>{isLoading ? 'Signing in...' : 'Sign In'}</span>
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default LoginPage;
