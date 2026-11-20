import { USE_MOCKS } from './env.js'

// Turns an axios error into a short message we can show the user.
// The backend sends errors shaped like { status, message, errors: [...] } (see CLAUDE.md).
export function getErrorMessage(error, fallback = 'Something went wrong') {
  if (error.response?.data?.message) {
    return error.response.data.message
  }
  // In mock mode, a 404 without a message means the request skipped MSW and reached Vite.
  // This happens if the mock worker didn't start, or Chrome put it to sleep in a background tab.
  if (USE_MOCKS && error.response?.status === 404) {
    return 'The mock backend is not answering. Refresh the page (F5) and try again.'
  }
  // A request was sent but no response came back: server down or wrong URL
  if (error.request && !error.response) {
    return 'Cannot reach the server'
  }
  return fallback
}

// Turns the backend's field errors into a { fieldName: message } map for our own
// Tailwind forms. Returns null when there are none.
// errors: [{ field: "candidatePersonalEmail", message: "Invalid email" }]
export function fieldErrorMap(error) {
  const fieldErrors = error.response?.data?.errors ?? []
  if (fieldErrors.length === 0) return null
  const map = {}
  for (const { field, message } of fieldErrors) {
    const name = field.split(/[.[\]]+/).filter(Boolean)[0]
    if (name && !map[name]) map[name] = message
  }
  return map
}

// Shows the backend's field errors under the matching form inputs.
// errors: [{ field: "candidatePersonalEmail", message: "Invalid email" }]
// Spring names list fields like "interviewers[0].email"; antd wants ['interviewers', 0, 'email'].
// Returns true if at least one field error was shown.
export function showFieldErrors(form, error) {
  const fieldErrors = error.response?.data?.errors ?? []
  if (fieldErrors.length === 0) {
    return false
  }
  form.setFields(
    fieldErrors.map(({ field, message }) => ({
      name: field
        .split(/[.[\]]+/)
        .filter(Boolean)
        .map((part) => (/^\d+$/.test(part) ? Number(part) : part)),
      errors: [message],
    })),
  )
  return true
}
