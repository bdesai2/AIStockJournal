import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { TradesPage } from '@/pages/TradesPage'
import { TradeDetailPage } from '@/pages/TradeDetailPage'
import { NewTradePage } from '@/pages/NewTradePage'
import { JournalPage } from '@/pages/JournalPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { StrategiesPage } from '@/pages/StrategiesPage'
import { PricingPage } from '@/pages/PricingPage'
import { AdminDashboardPage } from '@/pages/AdminDashboardPage'
import { PrivacyPolicyPage } from '@/pages/PrivacyPolicyPage'
import { TermsOfServicePage } from '@/pages/TermsOfServicePage'
import { DisclaimersPage } from '@/pages/DisclaimersPage'
import { CookiePolicyPage } from '@/pages/CookiePolicyPage'

export const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'callback', element: <AuthCallbackPage /> },
    ],
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'trades', element: <TradesPage /> },
      { path: 'trades/new', element: <NewTradePage /> },
      { path: 'trades/:id', element: <TradeDetailPage /> },
      { path: 'trades/:id/edit', element: <NewTradePage /> },
      { path: 'journal', element: <JournalPage /> },
      { path: 'strategies', element: <StrategiesPage /> },
      { path: 'pricing', element: <PricingPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'admin', element: <AdminDashboardPage /> },
      { path: 'privacy', element: <PrivacyPolicyPage /> },
      { path: 'terms', element: <TermsOfServicePage /> },
      { path: 'disclaimers', element: <DisclaimersPage /> },
      { path: 'cookie-policy', element: <CookiePolicyPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
