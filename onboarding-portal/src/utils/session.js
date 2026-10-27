// Small helpers for the sign-in session, shared by the API client, AuthProvider,
// the login page and the idle-timeout warning.

// localStorage is shared by every tab, so activity in one tab keeps the others alive
const IDLE_MINUTES_KEY = 'idleTimeoutMinutes'
const LAST_ACTIVITY_KEY = 'lastActivityAt'
// sessionStorage is per tab: the message the login page shows after a sign-out
const SIGNED_OUT_REASON_KEY = 'signedOutReason'

const DEFAULT_IDLE_MINUTES = 30

// The server's idle timeout (sent at login), in milliseconds
export function getIdleTimeoutMs() {
  const minutes = Number(localStorage.getItem(IDLE_MINUTES_KEY)) || DEFAULT_IDLE_MINUTES
  return minutes * 60 * 1000
}

export function setIdleTimeoutMinutes(minutes) {
  localStorage.setItem(IDLE_MINUTES_KEY, String(minutes || DEFAULT_IDLE_MINUTES))
}

// When the user last did something (mouse, keyboard, scroll, touch) in any tab
export function getLastActivity() {
  return Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now()
}

export function markActivity(at = Date.now()) {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(at))
}

// Remember why we're sending the user to the login page...
export function setSignedOutReason(message) {
  if (message) sessionStorage.setItem(SIGNED_OUT_REASON_KEY, message)
}

// ...read it on the login page...
export function getSignedOutReason() {
  return sessionStorage.getItem(SIGNED_OUT_REASON_KEY)
}

// ...then forget it, so it isn't shown again on the next visit
export function clearSignedOutReason() {
  sessionStorage.removeItem(SIGNED_OUT_REASON_KEY)
}
