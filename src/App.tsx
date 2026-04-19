import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { CookieConsentBanner } from '@/components/cookies/CookieConsentBanner'

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <CookieConsentBanner />
    </>
  )
}
