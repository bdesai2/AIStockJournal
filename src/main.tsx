import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { initAuth } from './store/authStore'
import './index.css'

// Initialize Supabase auth listener before rendering
initAuth()

// Register service worker (production only)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .catch((err) => {
        console.error('[SW] registration failed', err)
      })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
