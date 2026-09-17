/**
 * Invite link helpers shared by the Invites and Access requests panels in
 * Settings, so both produce identical signup links and emails.
 */

export const buildInviteLink = (code: string, email?: string | null, origin: string = window.location.origin): string => {
  const params = new URLSearchParams({ code });
  if (email) params.set('email', email);
  return `${origin}/signup?${params.toString()}`;
};

/**
 * No SMTP/email service is configured, so this builds a mailto: URL that
 * opens the admin's own mail client pre-filled with the invite, rather than
 * sending anything server-side.
 */
export const buildInviteMailto = (code: string, email: string, origin: string = window.location.origin): string => {
  const subject = encodeURIComponent('Your STONKS invite');
  const body = encodeURIComponent(
    `Thanks for your interest in STONKS - your access request has been approved.\n\n` +
      `Create your account here (the link works once):\n\n${buildInviteLink(code, email, origin)}`,
  );
  return `mailto:${email}?subject=${subject}&body=${body}`;
};
