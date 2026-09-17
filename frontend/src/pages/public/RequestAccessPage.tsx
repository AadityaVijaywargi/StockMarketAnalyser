import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail, Send } from 'lucide-react';
import { PublicLayout } from '../../components/public/PublicLayout';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { apiService } from '../../services/api';
import { SITE_NAME } from '../../config/site';
import { trackEvent } from '../../services/analytics';
import { MAX_MESSAGE_LENGTH, validateAccessRequest, AccessRequestErrors } from '../../utils/access_request_validation';

/**
 * The page the site's single call to action points at.
 *
 * Validation runs in two places on purpose. The checks here exist to give
 * immediate, specific feedback; the authoritative ones are in
 * api/routers/access.py, because anything enforced only in the browser is
 * advisory. The two must agree on limits - MAX_MESSAGE_LENGTH mirrors
 * access_request_store.MAX_MESSAGE_LENGTH.
 *
 * Spam handling is deliberately invisible to legitimate users: a honeypot
 * field and a render timestamp, no CAPTCHA. See the router docstring.
 */
export const RequestAccessPage: React.FC = () => {
  useDocumentMeta({
    title: 'Request access',
    description: `Request an invite to ${SITE_NAME}, a private equity research platform for NSE and BSE stocks. Requests are reviewed by hand.`,
    canonicalPath: '/request-access',
  });

  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<AccessRequestErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  // Only validate on change *after* a failed submit, so the form does not
  // shout at someone who is still typing their email for the first time.
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Stamped once, when the form first renders.
  const renderedAt = useMemo(() => Date.now(), []);
  const emailRef = useRef<HTMLInputElement>(null);

  const runValidation = (): boolean => {
    const found = validateAccessRequest({ email, message });
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);
    setSubmitError(null);

    if (!runValidation()) {
      emailRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      await apiService.submitAccessRequest({
        email: email.trim(),
        message: message.trim(),
        company_website: honeypot,
        rendered_at: renderedAt,
      });
      trackEvent('access-request-submitted');
      setIsDone(true);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429) {
        setSubmitError(
          err?.response?.data?.detail ||
            'Too many requests from your network. Please try again in a little while.',
        );
      } else if (status === 422) {
        setSubmitError('That email address was not accepted. Please check it and try again.');
      } else {
        setSubmitError(
          'We could not send your request. Check your connection and try again — or email us directly.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDone) {
    return (
      <PublicLayout hideCta>
        <div className="max-w-md mx-auto px-5 sm:px-6 py-20 sm:py-28 text-center flex flex-col items-center gap-5">
          <span className="w-14 h-14 rounded-2xl bg-bullish/10 border border-bullish/30 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-bullish" aria-hidden="true" />
          </span>
          {/* role="status" announces this to a screen reader without stealing focus. */}
          <div role="status">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">Request received</h1>
            <p className="text-sm text-textMuted leading-relaxed">
              Thanks — it is in the queue. We review requests by hand, usually within a couple
              of days, and you will get an invite code by email if you are approved.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 mt-2 px-5 py-3 rounded-xl border border-borderDark hover:border-white/20 text-textMuted hover:text-white font-semibold text-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout hideCta>
      <div className="max-w-md mx-auto px-5 sm:px-6 py-12 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">Request access</h1>
          <p className="text-sm text-textMuted leading-relaxed mb-8">
            {SITE_NAME} is invite-only while it is in private beta. Leave your email and we will
            get back to you — usually within a couple of days.
          </p>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            {/* Honeypot. Positioned off-screen rather than display:none, which
                the more careful bots check for, and removed from the
                accessibility tree and tab order so no human ever reaches it. */}
            <div aria-hidden="true" className="absolute -left-[9999px] top-auto w-px h-px overflow-hidden">
              <label htmlFor="company_website">Company website (leave blank)</label>
              <input
                id="company_website"
                name="company_website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={e => setHoneypot(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-[11px] font-semibold text-textMuted font-mono uppercase tracking-wider"
              >
                Email address
              </label>
              <div className="relative">
                <Mail
                  className="w-4 h-4 text-textMuted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (hasSubmitted) setErrors(validateAccessRequest({ email: e.target.value, message }));
                  }}
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  placeholder="you@example.com"
                  className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-background border outline-none text-sm text-white font-mono transition-all ${
                    errors.email ? 'border-bearish focus:border-bearish' : 'border-borderDark focus:border-brand/60'
                  }`}
                />
              </div>
              {errors.email && (
                <p id="email-error" className="flex items-center gap-1.5 text-xs text-bearish mt-0.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {errors.email}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="message"
                className="text-[11px] font-semibold text-textMuted font-mono uppercase tracking-wider"
              >
                Anything we should know? <span className="normal-case font-sans">(optional)</span>
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                value={message}
                onChange={e => {
                  setMessage(e.target.value);
                  if (hasSubmitted) setErrors(validateAccessRequest({ email, message: e.target.value }));
                }}
                aria-invalid={errors.message ? true : undefined}
                aria-describedby={errors.message ? 'message-error message-count' : 'message-count'}
                placeholder="How you invest, what you would use it for — anything that helps us place your request."
                className={`w-full px-3.5 py-2.5 rounded-xl bg-background border outline-none text-sm text-white resize-y transition-all ${
                  errors.message ? 'border-bearish focus:border-bearish' : 'border-borderDark focus:border-brand/60'
                }`}
              />
              <div className="flex items-start justify-between gap-3">
                {errors.message ? (
                  <p id="message-error" className="flex items-center gap-1.5 text-xs text-bearish">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    {errors.message}
                  </p>
                ) : (
                  <span />
                )}
                <p id="message-count" className="text-[11px] text-textMuted font-mono shrink-0">
                  {message.length}/{MAX_MESSAGE_LENGTH}
                </p>
              </div>
            </div>

            {submitError && (
              // role="alert" so the failure is announced immediately rather
              // than silently appearing for screen-reader users.
              <div
                role="alert"
                className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-bearish/10 border border-bearish/30 text-bearish text-xs"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
                <span>{submitError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand text-white font-bold text-sm transition-all hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="w-4 h-4" aria-hidden="true" />
              )}
              {isSubmitting ? 'Sending…' : 'Request access'}
            </button>

            <p className="text-xs text-textMuted text-center leading-relaxed">
              We use your email only to respond to this request. See our{' '}
              <Link to="/privacy" className="text-brandText underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>
          </form>

          <p className="text-center text-xs text-textMuted mt-8 pt-6 border-t border-borderDark">
            Already have an invite?{' '}
            <Link to="/login" className="text-brandText hover:underline font-semibold">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </PublicLayout>
  );
};

export default RequestAccessPage;
