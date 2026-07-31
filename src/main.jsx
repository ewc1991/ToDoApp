import React from 'react'
import ReactDOM from 'react-dom/client'

// Self-hosted variable fonts. A font CDN is exactly what fails on a bad
// connection, and offline it never arrives — fatal for a PWA.
import '@fontsource-variable/nunito'   // display face — wordmark, headings, names of things
import '@fontsource-variable/inter'    // body face — everything the system says

import App from './App.jsx'
import './App.css'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { AuthProvider } from './store/AuthContext.jsx'
import { AppProvider } from './store/AppContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
