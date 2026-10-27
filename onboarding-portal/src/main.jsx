import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App as AntApp, ConfigProvider } from 'antd'
import './index.css'
import theme from './theme.js'
import App from './App.jsx'
import AuthProvider from './context/AuthProvider.jsx'
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
        {/* ConfigProvider applies our colors, font and roundness (src/theme.js) to every antd component */}
        <ConfigProvider theme={theme}>
          {/* AntApp makes antd's message / notification / modal helpers work anywhere in the app */}
          <AntApp>
            {/* AuthProvider makes the logged-in user available to every page */}
            <AuthProvider>
              <App />
            </AuthProvider>
          </AntApp>
        </ConfigProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}

enableMocking()
  // If the fake backend can't start, still show the app (instead of a blank page).
  // API calls will then fail with a message explaining what to do.
  .catch((error) => console.error('Mock backend failed to start:', error))
  .then(renderApp)
