import { describe, expect, it } from 'vitest';
import { MAX_MESSAGE_LENGTH, validateAccessRequest } from './access_request_validation';

describe('validateAccessRequest', () => {
  it('accepts a normal email with no message', () => {
    expect(validateAccessRequest({ email: 'someone@example.com', message: '' })).toEqual({});
  });

  it('accepts subdomains, plus-addressing and surrounding whitespace', () => {
    expect(validateAccessRequest({ email: '  a.b+tag@mail.example.co.in ', message: '' })).toEqual({});
  });

  it.each(['', '   ', 'plain', 'missing@tld', '@example.com', 'a b@example.com', 'a@@example.com', 'a@example.'])(
    'rejects %j',
    email => {
      expect(validateAccessRequest({ email, message: '' }).email).toBeTruthy();
    },
  );

  it('asks for an email specifically when it is empty', () => {
    expect(validateAccessRequest({ email: '', message: '' }).email).toMatch(/enter your email/i);
  });

  it('rejects an email longer than the RFC limit', () => {
    const email = `${'a'.repeat(250)}@example.com`;
    expect(validateAccessRequest({ email, message: '' }).email).toMatch(/too long/i);
  });

  it('allows a message exactly at the limit', () => {
    const message = 'x'.repeat(MAX_MESSAGE_LENGTH);
    expect(validateAccessRequest({ email: 'a@example.com', message })).toEqual({});
  });

  it('rejects a message over the limit', () => {
    const message = 'x'.repeat(MAX_MESSAGE_LENGTH + 1);
    expect(validateAccessRequest({ email: 'a@example.com', message }).message).toBeTruthy();
  });

  it('does not count trailing whitespace toward the limit', () => {
    const message = `${'x'.repeat(MAX_MESSAGE_LENGTH)}   \n`;
    expect(validateAccessRequest({ email: 'a@example.com', message })).toEqual({});
  });
});
