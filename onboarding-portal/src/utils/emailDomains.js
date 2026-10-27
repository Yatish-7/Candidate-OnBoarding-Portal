// The portal is for company email ids only. This list must match app.allowed-email-domains in the
// backend (application.properties); the server is what really enforces it.
export const ALLOWED_EMAIL_DOMAINS = [
  'intellectt.com',
  'novozen.com',
  'revereit.com',
  'premierlifesciences.com',
  'unitedpharmatechnologies.com',
  'kennedysoft.com',
  'shoolin-inc.com',
  'lumininc.com',
  'lumin-innovations.com',
  'kkrconsulting.com',
  'ubitz.ai',
]

export function isAllowedEmail(email) {
  const at = String(email ?? '').lastIndexOf('@')
  return at > 0 && ALLOWED_EMAIL_DOMAINS.includes(email.slice(at + 1).trim().toLowerCase())
}

// An antd form rule: the sign-in page and the user form show this message under the email box
export const companyEmailRule = {
  validator: (_, value) =>
    !value || isAllowedEmail(value)
      ? Promise.resolve()
      : Promise.reject(new Error('Please use your correct company email id (for example name@intellectt.com)')),
}
