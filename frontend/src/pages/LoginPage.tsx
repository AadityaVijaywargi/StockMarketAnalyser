import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Loader2, AlertCircle, TrendingUp, User, Eye, EyeOff } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../components/AuthLayout';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      setError(typeof detail === 'string' ? detail : 'Login failed. Check your username and password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm bg-surface border border-borderDark rounded-2xl shadow-premium p-7 flex flex-col gap-6"
      >
        <div className="flex flex-col items-center gap-2 text-center lg:hidden">
          <div className="w-11 h-11 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-brand" />
          </div>
          <h1 className="font-extrabold text-lg text-white font-mono tracking-tight">STONKS</h1>
        </div>
        <div className="hidden lg:block">
          <h2 className="font-extrabold text-xl text-white tracking-tight">Welcome back</h2>
        </div>
        <p className="text-xs text-textMuted -mt-4 lg:-mt-2 text-center lg:text-left">Sign in to access the research platform</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-textMuted font-mono uppercase tracking-wider">Username</label>
            <div className="relative">
              <User className="w-4 h-4 text-textMuted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-background border border-borderDark focus:border-brand/60 outline-none text-sm text-white font-mono transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-textMuted font-mono uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-textMuted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-background border border-borderDark focus:border-brand/60 outline-none text-sm text-white font-mono transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-white transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
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

        <p className="text-center text-xs text-textMuted">
          Invited by email?{' '}
          <Link to="/signup" className="text-brand hover:underline font-semibold">Sign up</Link>
        </p>
      </motion.div>
    </AuthLayout>
  );
};

export default LoginPage;
