/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_URL } from './config/site';

// Vitest runs from the frontend package root.
const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf-8');

const PUBLIC_INDEXABLE = ['/', '/request-access', '/privacy', '/terms', '/cookies'];

describe('sitemap.xml', () => {
  const sitemap = read('public/sitemap.xml');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

  it('lists exactly the public indexable routes', () => {
    expect(locs.map(l => l.replace(SITE_URL, '') || '/').sort()).toEqual([...PUBLIC_INDEXABLE].sort());
  });

  it('uses the canonical site URL', () => {
    for (const loc of locs) expect(loc.startsWith(`${SITE_URL}/`)).toBe(true);
  });

  it('only lists routes that App.tsx actually renders', () => {
    const app = read('src/App.tsx');
    for (const path of PUBLIC_INDEXABLE) expect(app).toContain(`path="${path}"`);
  });
});

describe('robots.txt', () => {
  const robots = read('public/robots.txt');

  it('points at the sitemap on the canonical host', () => {
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });

  it('does not block any public indexable route', () => {
    const disallowed = [...robots.matchAll(/^Disallow:\s*(\S+)/gm)].map(m => m[1]);
    for (const path of PUBLIC_INDEXABLE) {
      for (const rule of disallowed) {
        if (path !== '/') expect(path.startsWith(rule)).toBe(false);
      }
    }
    expect(disallowed).not.toContain('/');
  });
});

describe('index.html', () => {
  const html = read('index.html');

  it('references social and icon assets that exist', () => {
    for (const asset of ['og-image.png', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'site.webmanifest']) {
      expect(html).toContain(asset);
      expect(statSync(join(root, 'public', asset)).size).toBeGreaterThan(0);
    }
  });

  it('keeps the social preview image small enough for link scrapers', () => {
    expect(statSync(join(root, 'public/og-image.png')).size).toBeLessThan(300 * 1024);
  });

  it('uses the canonical site URL for absolute links', () => {
    for (const m of html.matchAll(/content="(https:\/\/[^"]+)"|href="(https:\/\/stock[^"]+)"/g)) {
      const url = m[1] || m[2];
      if (url.includes('fonts.')) continue;
      expect(url.startsWith(SITE_URL)).toBe(true);
    }
  });
});

describe('no secrets in frontend source', () => {
  // Anything in src/ ships to every visitor's browser. Only VITE_API_URL,
  // VITE_SITE_URL and the Umami settings are meant to be public.
  const SECRET_PATTERNS = [
    /AIza[0-9A-Za-z_-]{35}/, // Google API key
    /sk-[A-Za-z0-9]{20,}/, // OpenAI/Anthropic-style key
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /(JWT_SECRET|ADMIN_PASSWORD|DATABASE_URL|GEMINI_API_KEY)/,
    /postgres(ql)?:\/\/[^\s'"]+:[^\s'"]+@/,
  ];
  const ALLOWED_ENV = new Set(['VITE_API_URL', 'VITE_SITE_URL', 'VITE_UMAMI_WEBSITE_ID', 'VITE_UMAMI_SRC']);

  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) files.push(full);
    }
  };
  walk(join(root, 'src'));

  it.each(files.map(f => [f.slice(root.length + 1), f]))('%s contains no secrets', (_rel, file) => {
    const text = readFileSync(file, 'utf-8');
    for (const pattern of SECRET_PATTERNS) expect(text).not.toMatch(pattern);
    for (const m of text.matchAll(/import\.meta\.env\.(\w+)/g)) {
      if (['PROD', 'DEV', 'MODE', 'BASE_URL', 'SSR'].includes(m[1])) continue;
      expect(ALLOWED_ENV.has(m[1])).toBe(true);
    }
  });
});
