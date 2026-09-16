/**
 * Client-side validation for the public access-request form.
 *
 * Pure and dependency-free so it can be unit tested without rendering the
 * page. These checks are for fast, specific feedback only - the server
 * enforces the same rules in api/routers/access.py, and anything validated
 * exclusively here is advisory.
 *
 * MAX_MESSAGE_LENGTH mirrors access_request_store.MAX_MESSAGE_LENGTH; if one
 * moves, the other has to move with it or the form will happily submit
 * something the API rejects with a 422.
 */

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_EMAIL_LENGTH = 254; // RFC 5321 maximum

export interface AccessRequestInput {
  email: string;
  message: string;
}

export interface AccessRequestErrors {
  email?: string;
  message?: string;
}

/**
 * Pragmatic email check: one @, a non-empty local part, a dotted domain, and
 * no whitespace. Deliberately not RFC 5322 - a regex strict enough to fully
 * implement that specification rejects addresses that real mail servers
 * accept, and the authoritative check is the confirmation email anyway.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export const validateAccessRequest = ({ email, message }: AccessRequestInput): AccessRequestErrors => {
  const errors: AccessRequestErrors = {};

  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    errors.email = 'Enter your email address so we can reply.';
  } else if (trimmedEmail.length > MAX_EMAIL_LENGTH) {
    errors.email = 'That email address is too long.';
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = 'That does not look like a valid email address.';
  }

  // Trailing whitespace should not be what pushes someone over the limit,
  // so the length check matches what actually gets submitted.
  if (message.trim().length > MAX_MESSAGE_LENGTH) {
    errors.message = `Please keep this under ${MAX_MESSAGE_LENGTH} characters.`;
  }

  return errors;
};
