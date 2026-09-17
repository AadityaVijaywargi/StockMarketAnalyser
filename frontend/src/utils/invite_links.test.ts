import { describe, expect, it } from 'vitest';
import { buildInviteLink, buildInviteMailto } from './invite_links';

const ORIGIN = 'https://stonks.example';

describe('buildInviteLink', () => {
  it('points at signup with the code', () => {
    expect(buildInviteLink('abc123', null, ORIGIN)).toBe(`${ORIGIN}/signup?code=abc123`);
  });

  it('includes and encodes the email when given', () => {
    const url = new URL(buildInviteLink('abc', 'a+b@example.com', ORIGIN));
    expect(url.searchParams.get('code')).toBe('abc');
    expect(url.searchParams.get('email')).toBe('a+b@example.com');
  });
});

describe('buildInviteMailto', () => {
  it('addresses the requester and embeds the signup link', () => {
    const mailto = buildInviteMailto('abc', 'someone@example.com', ORIGIN);
    expect(mailto.startsWith('mailto:someone@example.com?')).toBe(true);
    const body = decodeURIComponent(mailto.split('body=')[1]);
    expect(body).toContain(buildInviteLink('abc', 'someone@example.com', ORIGIN));
  });
});
