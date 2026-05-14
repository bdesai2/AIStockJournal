import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { initAuth } from './store/authStore'
import './index.css'

const EXTENSION_ASYNC_CHANNEL_ERROR =
  'A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received'

// Initialize Supabase auth listener before rendering
initAuth()

// Suppress noisy extension-origin promise rejection in app console.
window.addEventListener('unhandledrejection', (event) => {
  const message = String((event.reason as { message?: string } | null)?.message ?? event.reason ?? '')
  if (message.includes(EXTENSION_ASYNC_CHANNEL_ERROR)) {
    event.preventDefault()
  }
})

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
