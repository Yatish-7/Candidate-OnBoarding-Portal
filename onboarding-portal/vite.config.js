import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Content-Security-Policy for the built app: the browser only runs our own scripts and
// only talks to our own API, so injected HTML (XSS) can't load or send anything.
// Production build only: the dev server needs inline scripts for hot reload.
// (frame-ancestors can't be set from a <meta> tag; set it as a header on the web
// server too, see OneIntellectt/SECURITY.md.)
function contentSecurityPolicy(apiBaseUrl) {
  let apiOrigin = ''
  try {
    apiOrigin = apiBaseUrl ? new URL(apiBaseUrl).origin : ''
  } catch {
    // relative or empty API URL: same origin, covered by 'self'
  }
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    // antd injects its styles at runtime, so inline styles must be allowed
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    `connect-src 'self' ${apiOrigin}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
    ],
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), contentSecurityPolicy(env.VITE_API_BASE_URL)],
  }
})
