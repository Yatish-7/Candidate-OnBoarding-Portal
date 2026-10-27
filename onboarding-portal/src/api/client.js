import axios from 'axios'
import { API_BASE_URL, USE_MOCKS } from '../utils/env.js'
import { setSignedOutReason } from '../utils/session.js'

// The key the login token is saved under in the browser's localStorage
export const TOKEN_KEY = 'token'

// One shared axios instance. Every API file (auth.js, candidates.js, ...) uses this.
const client = axios.create({
  // In mock mode requests go to our own site (/api/...), where MSW catches them.
  // Otherwise they go to the Spring Boot backend.
  baseURL: USE_MOCKS ? '' : API_BASE_URL,
})

// An "interceptor" runs before every request.
// Here it adds the login token so the backend knows who is calling.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ---- Mock mode only: recover when the mock backend stops answering ----
// If Chrome shut down the mock service worker, requests reach Vite instead of our mocks:
// GETs come back as an HTML page and POST/PUT as a 404 without a message.
// When we see that, restart the mocks and send the same request once more.
function missedTheMocks(response) {
  if (!response) return false
  const isHtml = String(response.headers?.['content-type'] ?? '').includes('text/html')
  const isBare404 = response.status === 404 && !response.data?.message
  return isHtml || isBare404
}

async function retryWithMocks(config) {
  if (!config._retriedWithMocks) {
    try {
      const { restartMocking } = await import('../mocks/browser.js')
      await restartMocking()
      return client.request({ ...config, _retriedWithMocks: true })
    } catch (error) {
      console.error('Could not restart the mock backend:', error)
    }
  }
  // Still not working: fail with a 404, which getErrorMessage() turns into "refresh the page"
  return Promise.reject(Object.assign(new Error('Mock backend not answering'), { config, response: { status: 404, data: {} } }))
}

if (USE_MOCKS) {
  client.interceptors.response.use(
    (response) => (missedTheMocks(response) ? retryWithMocks(response.config) : response),
    (error) => (missedTheMocks(error.response) ? retryWithMocks(error.config) : Promise.reject(error)),
  )
}

// This one runs after every response. A 401 means our session has ended (signed out,
// signed in elsewhere, idle timeout, deactivated, ...). The backend says why in
// `message`; keep it for the login page, forget the token, and go sign in again.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? ''
    const isAuthCall = url.includes('/api/auth/login') || url.includes('/api/auth/logout')
    // Still on an admin-set password: the backend allows nothing else until it's changed
    if (error.response?.data?.reason === 'PASSWORD_CHANGE_REQUIRED' && window.location.pathname !== '/change-password') {
      window.location.assign('/change-password')
    }
    if (error.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem(TOKEN_KEY)
      // Already on the login page (e.g. a stale token checked on page load)? Stay put, quietly.
      if (window.location.pathname !== '/login') {
        setSignedOutReason(error.response?.data?.message)
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)

export default client
