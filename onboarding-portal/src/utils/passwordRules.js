// Same rule the backend enforces (CredentialRules.java): 8-72 characters with at
// least one letter and one number. The backend re-checks; this just gives instant feedback.
export const PASSWORD_HINT = '8+ characters, with a letter and a number'

// Plain validator for our own Tailwind forms: returns an error message, or null when ok.
export function validatePassword(value, requiredMessage = 'Enter a password') {
  if (!value) return requiredMessage
  const bytes = new TextEncoder().encode(value).length
  if (value.length < 8 || bytes > 72 || !/\p{L}/u.test(value) || !/\d/.test(value)) {
    return `Use ${PASSWORD_HINT} (max 72)`
  }
  return null
}

export const passwordRules = (requiredMessage) => [
  { required: true, message: requiredMessage },
  {
    validator: (_, value) => {
      if (!value) return Promise.resolve()
      const bytes = new TextEncoder().encode(value).length
      if (value.length < 8 || bytes > 72 || !/\p{L}/u.test(value) || !/\d/.test(value)) {
        return Promise.reject(new Error(`Use ${PASSWORD_HINT} (max 72)`))
      }
      return Promise.resolve()
    },
  },
]
