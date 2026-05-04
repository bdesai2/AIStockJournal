import { Suspense, lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage').then((m) => ({ default: m.AuthCallbackPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const OpenPositionsDashboardPage = lazy(() => import('@/pages/OpenPositionsDashboardPage').then((m) => ({ default: m.OpenPositionsDashboardPage })))
const TradesPage = lazy(() => import('@/pages/TradesPage').then((m) => ({ default: m.TradesPage })))
const TradeDetailPage = lazy(() => import('@/pages/TradeDetailPage').then((m) => ({ default: m.TradeDetailPage })))
const NewTradePage = lazy(() => import('@/pages/NewTradePage').then((m) => ({ default: m.NewTradePage })))
const JournalPage = lazy(() => import('@/pages/JournalPage').then((m) => ({ default: m.JournalPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const StrategiesPage = lazy(() => import('@/pages/StrategiesPage').then((m) => ({ default: m.StrategiesPage })))
const PricingPage = lazy(() => import('@/pages/PricingPage').then((m) => ({ default: m.PricingPage })))
const AdminDashboardPage = lazy(() => import('@/pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })))
const PrivacyPolicyPage = lazy(() => import('@/pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })))
const TermsOfServicePage = lazy(() => import('@/pages/TermsOfServicePage').then((m) => ({ default: m.TermsOfServicePage })))
const DisclaimersPage = lazy(() => import('@/pages/DisclaimersPage').then((m) => ({ default: m.DisclaimersPage })))
const CookiePolicyPage = lazy(() => import('@/pages/CookiePolicyPage').then((m) => ({ default: m.CookiePolicyPage })))

function withSuspense(node: React.ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex items-center justify-center h-full">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      {node}
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { path: 'login', element: withSuspense(<LoginPage />) },
      { path: 'callback', element: withSuspense(<AuthCallbackPage />) },
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
      { path: 'dashboard', element: withSuspense(<DashboardPage />) },
      { path: 'open-positions', element: withSuspense(<OpenPositionsDashboardPage />) },
      { path: 'trades', element: withSuspense(<TradesPage />) },
      { path: 'trades/new', element: withSuspense(<NewTradePage />) },
      { path: 'trades/:id', element: withSuspense(<TradeDetailPage />) },
      { path: 'trades/:id/edit', element: withSuspense(<NewTradePage />) },
      { path: 'journal', element: withSuspense(<JournalPage />) },
      { path: 'strategies', element: withSuspense(<StrategiesPage />) },
      { path: 'pricing', element: withSuspense(<PricingPage />) },
      { path: 'settings', element: withSuspense(<SettingsPage />) },
      { path: 'admin', element: withSuspense(<AdminDashboardPage />) },
      { path: 'privacy', element: withSuspense(<PrivacyPolicyPage />) },
      { path: 'terms', element: withSuspense(<TermsOfServicePage />) },
      { path: 'disclaimers', element: withSuspense(<DisclaimersPage />) },
      { path: 'cookie-policy', element: withSuspense(<CookiePolicyPage />) },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
