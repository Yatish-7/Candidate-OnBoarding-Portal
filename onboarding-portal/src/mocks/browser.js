import { setupWorker } from 'msw/browser'
import { handlers } from './handlers.js'

// The "worker" runs in the browser and answers API calls using our handlers.
// It uses public/mockServiceWorker.js (created by `npx msw init public`).
export const worker = setupWorker(...handlers)

// 'bypass' lets requests we don't mock (images, Vite's own files) go through normally
const START_OPTIONS = { onUnhandledRequest: 'bypass' }

export function startMocking() {
  return worker.start(START_OPTIONS)
}

// Chrome sometimes shuts down the service worker (for example while the tab is in the
// background). When it starts again it has forgotten this tab and stops mocking.
// Restarting tells it about this tab again. Used by src/api/client.js.
export async function restartMocking() {
  worker.stop()
  await worker.start({ ...START_OPTIONS, quiet: true })
}
