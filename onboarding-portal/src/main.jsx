import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import AuthProvider from './context/AuthProvider.jsx'
import { UIProvider } from './ui/index.js'
import { USE_MOCKS } from './utils/env.js'

// In mock mode, start the fake backend (MSW) before the app makes any API calls
async function enableMocking() {
  if (!USE_MOCKS) {
    return
  }
  // import() loads the mock code only when needed
  const { startMocking } = await import('./mocks/browser.js')
  await startMocking()
}

function renderApp() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      {/* BrowserRouter lets us use URLs like /candidates and /candidates/12 */}
      <BrowserRouter>
        {/* UIProvider supplies the toast + confirm dialog used across the app */}
        <UIProvider>
          {/* AuthProvider makes the logged-in user available to every page */}
          <AuthProvider>
            <App />
          </AuthProvider>
        </UIProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}

enableMocking()
  // If the fake backend can't start, still show the app (instead of a blank page).
  // API calls will then fail with a message explaining what to do.
  .catch((error) => console.error('Mock backend failed to start:', error))
  .then(renderApp)
