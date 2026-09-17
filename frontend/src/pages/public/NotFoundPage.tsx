import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';
import { PublicLayout } from '../../components/public/PublicLayout';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useAuth } from '../../context/AuthContext';

/**
 * Custom 404.
 *
 * Replaces the previous catch-all `<Route path="*" element={<Navigate to="/" />} />`,
 * which silently turned every mistyped URL into the home page. That hid
 * broken links from users and, worse, served HTTP 200 with home-page content
 * for URLs that do not exist - a soft 404, which search engines treat as a
 * quality problem and which can get real pages deindexed.
 *
 * We cannot return a real 404 status from a static SPA host, so the page is
 * marked noindex instead: that is the supported way to tell a crawler this
 * URL has nothing to index.
 */
export const NotFoundPage: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  useDocumentMeta({
    title: 'Page not found',
    description: 'The page you were looking for does not exist.',
    noIndex: true,
  });

  return (
    <PublicLayout>
      <div className="max-w-xl mx-auto px-5 sm:px-6 py-20 sm:py-28 text-center flex flex-col items-center gap-5">
        <span className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-borderDark flex items-center justify-center">
          <Compass className="w-6 h-6 text-brandText" aria-hidden="true" />
        </span>

        <p className="text-xs font-mono font-bold tracking-[0.2em] text-textMuted uppercase">
          Error 404
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Page not found</h1>

        <p className="text-sm text-textMuted leading-relaxed">
          We could not find{' '}
          <code className="font-mono text-xs text-white bg-surface border border-borderDark rounded px-1.5 py-0.5 break-all">
            {location.pathname}
          </code>
          . It may have been moved, or the link that brought you here may be wrong.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full sm:w-auto">
          <Link
            to={isAuthenticated ? '/app' : '/'}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand hover:brightness-110 text-white font-bold text-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {isAuthenticated ? 'Back to dashboard' : 'Back to home'}
          </Link>
          {!isAuthenticated && (
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-5 py-3 rounded-xl border border-borderDark hover:border-white/20 text-textMuted hover:text-white font-semibold text-sm transition-all"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </PublicLayout>
  );
};

export default NotFoundPage;
