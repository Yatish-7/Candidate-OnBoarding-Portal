import { useEffect, useState } from 'react'
import * as authApi from '../api/auth.js'
import { TOKEN_KEY } from '../api/client.js'
import { markActivity, setIdleTimeoutMinutes, setSignedOutReason } from '../utils/session.js'
import { AuthContext } from './AuthContext.js'

// Wraps the whole app (see main.jsx) and keeps track of who is logged in.
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // true while we check a saved token on page load, so we don't flash the login page.
  // If there's no saved token there's nothing to check, so we start with false.
  const [loading, setLoading] = useState(() => localStorage.getItem(TOKEN_KEY) !== null)

  // On page load (or refresh): if a token was saved earlier, ask the backend who it belongs to
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      return
    }
    authApi
      .getMe()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY)) // session ended or token invalid
      .finally(() => setLoading(false))
  }, [])

  // Keep every open tab in step: signing out (or in) in one tab updates the others
  useEffect(() => {
    function onStorage(event) {
      if (event.key !== TOKEN_KEY) return
      if (event.newValue === null) {
        if (window.location.pathname !== '/login') {
          setSignedOutReason('You were signed out in another tab.')
          window.location.assign('/login')
        }
      } else {
        window.location.reload() // someone signed in (maybe as another user) in another tab
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Throws if the email/password is wrong; the login page catches it and shows the message
  async function login(email, password) {
    const data = await authApi.login(email, password)
    localStorage.setItem(TOKEN_KEY, data.token)
    setIdleTimeoutMinutes(data.idleTimeoutMinutes)
    markActivity() // the idle clock starts now
    setUser(data.user)
    return data.user
  }

  // Ends the session on the server too, so the token can't be reused.
  // reason: 'IDLE_TIMEOUT' for an automatic sign-out, otherwise a normal one.
  async function logout(reason) {
    if (localStorage.getItem(TOKEN_KEY)) {
      try {
        await authApi.logout(reason)
      } catch {
        // Signing out locally is what matters; the server session will time out anyway
      }
    }
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  // Re-reads the signed-in user from the server (e.g. after changing the password)
  async function refreshUser() {
    const fresh = await authApi.getMe()
    setUser(fresh)
    return fresh
  }

  const value = { user, role: user?.role ?? null, loading, login, logout, refreshUser }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
