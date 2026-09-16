import React from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from './PublicLayout';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { LEGAL_LAST_UPDATED } from '../../config/site';

/**
 * Shared shell and typography for the privacy policy, terms and cookie
 * policy, so the three documents stay visually and structurally identical
 * and each page file contains only its own text.
 */

interface LegalPageProps {
  title: string;
  description: string;
  canonicalPath: string;
  children: React.ReactNode;
}

export const LegalPage: React.FC<LegalPageProps> = ({ title, description, canonicalPath, children }) => {
  useDocumentMeta({ title, description, canonicalPath });

  return (
    <PublicLayout>
      <article className="max-w-3xl mx-auto px-5 sm:px-6 py-12 sm:py-16">
        <header className="mb-10 pb-8 border-b border-borderDark">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">{title}</h1>
          <p className="text-xs text-textMuted font-mono">
            Last updated: <time dateTime="2026-09-16">{LEGAL_LAST_UPDATED}</time>
          </p>
        </header>

        <div className="flex flex-col gap-8">{children}</div>

        <footer className="mt-12 pt-8 border-t border-borderDark flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/privacy" className="text-xs text-textMuted hover:text-white transition-colors">
            Privacy Policy
          </Link>
          <Link to="/terms" className="text-xs text-textMuted hover:text-white transition-colors">
            Terms of Service
          </Link>
          <Link to="/cookies" className="text-xs text-textMuted hover:text-white transition-colors">
            Cookie Policy
          </Link>
        </footer>
      </article>
    </PublicLayout>
  );
};

/** A numbered top-level section of a legal document. */
export const Section: React.FC<{ id: string; heading: string; children: React.ReactNode }> = ({
  id,
  heading,
  children,
}) => (
  <section id={id} aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
    <h2 id={`${id}-heading`} className="text-lg font-bold tracking-tight">
      {heading}
    </h2>
    <div className="flex flex-col gap-3 text-sm text-textMuted leading-relaxed [&_strong]:text-white [&_strong]:font-semibold [&_a]:text-brandText [&_a]:underline [&_a]:underline-offset-2">
      {children}
    </div>
  </section>
);

/** Bulleted list with the spacing the legal pages use. */
export const Bullets: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="flex flex-col gap-2 pl-5 list-disc marker:text-borderDark">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);

export default LegalPage;
