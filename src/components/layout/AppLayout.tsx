import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { version } from '../../../package.json'
import {
  LayoutDashboard,
  BookOpen,
  LineChart,
  Settings,
  PlusCircle,
  LogOut,
  ChevronRight,
  Bell,
  Zap,
  WifiOff,
  Wifi,
  MonitorDown,
} from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { useRealtimeIndicator } from '@/hooks/useRealtimeStatus'
import {
  useTradeRealtimeSubscriptions,
  useExecutionRealtimeSubscriptions,
  useScreenshotRealtimeSubscriptions,
  useJournalRealtimeSubscriptions,
} from '@/hooks/useTradeRealtimeSubscriptions'
import { useAuthStore } from '@/store/authStore'
import { useTradeStore } from '@/store/tradeStore'
import { useJournalStore } from '@/store/journalStore'
import { auth } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  OFFLINE_QUEUE_UPDATED_EVENT,
  getOfflineQueueCount,
  getOfflineSyncFailureCount,
  getOfflineSyncFailureSummary,
} from '@/lib/offlineQueue'
import { NotificationToaster } from '@/components/notifications/NotificationToaster'
import { AccountBalanceCard } from '@/components/account/AccountBalanceCard'
import { AccountSelector } from '@/components/navigation/AccountSelector'
import { ManageAccountsModal } from '@/components/modals/ManageAccountsModal'
import { Footer } from '@/components/layout/Footer'
import { SessionTimeoutWarning } from '@/components/security/SessionTimeoutWarning'
import { useNotificationStore, type Notification } from '@/store/notificationStore'
import { aggregateStats } from '@/lib/tradeUtils'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/trades', icon: LineChart, label: 'Trades' },
  { to: '/journal', icon: BookOpen, label: 'Journal' },
  { to: '/strategies', icon: Zap, label: 'Strategies' },
]

const MOBILE_NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/trades', icon: LineChart, label: 'Trades' },
  { to: '/journal', icon: BookOpen, label: 'Journal' },
  { to: '/strategies', icon: Zap, label: 'Strategies' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

function getBreadcrumbs(pathname: string): Array<{ to: string; label: string }> {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return [{ to: '/dashboard', label: 'Dashboard' }]

  const crumbs: Array<{ to: string; label: string }> = []
  let running = ''

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]
    running += `/${part}`

    let label = part
    if (part === 'dashboard') label = 'Dashboard'
    if (part === 'trades') label = 'Trades'
    if (part === 'new') label = 'New Trade'
    if (part === 'journal') label = 'Journal'
    if (part === 'strategies') label = 'Strategies'
    if (part === 'settings') label = 'Settings'
    if (part === 'pricing') label = 'Pricing'
    if (part === 'admin') label = 'Admin'
    if (part === 'privacy') label = 'Privacy'
    if (part === 'terms') label = 'Terms'
    if (part === 'disclaimers') label = 'Disclaimers'
    if (part === 'cookie-policy') label = 'Cookie Policy'

    if (parts[i - 1] === 'trades' && part !== 'new' && part !== 'edit') {
      label = `Trade ${part.slice(0, 6)}`
    }
    if (part === 'edit') label = 'Edit'

    crumbs.push({ to: running, label })
  }

  return crumbs
}

export function AppLayout() {
  const { user, profile, selectedAccountId, subscription, fetchSubscription } = useAuthStore()
  const { trades, fetchTrades, flushQueuedMutations } = useTradeStore()
  const { flushQueuedMutations: flushQueuedJournals } = useJournalStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [accountsModalOpen, setAccountsModalOpen] = useState(false)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [pendingSyncCount, setPendingSyncCount] = useState(() => getOfflineQueueCount())
  const [failedSyncCount, setFailedSyncCount] = useState(() => getOfflineSyncFailureCount())
  const [failedSyncSummary, setFailedSyncSummary] = useState<string | null>(() => getOfflineSyncFailureSummary())
  const lastQueueFlushRef = useRef(0)
  const notifications = useNotificationStore((s) => s.notifications)
  const isOnline = useOnlineStatus()
  const { canInstall, isInstalled, installHelpText, install } = useInstallPrompt()
  const realtime = useRealtimeIndicator()
  const clearAllNotifications = useNotificationStore((s) => s.clearAll)

  const handleRetrySync = () => {
    if (!isOnline || !user?.id || !selectedAccountId) return
    void flushQueuedMutations(user.id, selectedAccountId)
    void flushQueuedJournals()
  }

  const handleNotificationClick = (n: Notification) => {
    setNotificationsOpen(false)

    if (n.tradeId) {
      navigate(`/trades/${n.tradeId}`)
      return
    }

    if (n.kind === 'journal_saved') {
      navigate('/journal')
      return
    }

    if (n.kind === 'weekly_digest_ready') {
      navigate('/dashboard')
      return
    }

    // Fallback: keep user on current page for info-only notifications
  }

  const handleSignOut = async () => {
    await auth.signOut()
    navigate('/auth/login')
  }

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?'

  useEffect(() => {
    if (user?.id && selectedAccountId && trades.length === 0) {
      fetchTrades(user.id, selectedAccountId)
    }

    // Refresh subscription data when layout loads (catches admin changes)
    if (user?.id) {
      fetchSubscription(user.id)
    }
  }, [user?.id, selectedAccountId, trades.length, fetchTrades, fetchSubscription])

  // Set up real-time subscriptions for trades, executions, screenshots, and journals
  useTradeRealtimeSubscriptions()
  useExecutionRealtimeSubscriptions()
  useScreenshotRealtimeSubscriptions()
  useJournalRealtimeSubscriptions()

  const stats = useMemo(() => aggregateStats(trades), [trades])
  const breadcrumbs = useMemo(() => getBreadcrumbs(location.pathname), [location.pathname])

  useEffect(() => {
    if (!isOnline || !user?.id || !selectedAccountId) return

    const now = Date.now()
    if (now - lastQueueFlushRef.current < 10_000) return
    lastQueueFlushRef.current = now

    void flushQueuedMutations(user.id, selectedAccountId)
    void flushQueuedJournals()
  }, [isOnline, user?.id, selectedAccountId, flushQueuedMutations, flushQueuedJournals])

  useEffect(() => {
    const refreshPendingCount = () => setPendingSyncCount(getOfflineQueueCount())
    const refreshFailures = () => {
      setFailedSyncCount(getOfflineSyncFailureCount())
      setFailedSyncSummary(getOfflineSyncFailureSummary())
    }
    const refreshAllSyncState = () => {
      refreshPendingCount()
      refreshFailures()
    }

    const onQueueUpdated = () => refreshAllSyncState()
    const onOnline = () => refreshAllSyncState()
    const onOffline = () => refreshAllSyncState()

    refreshAllSyncState()

    window.addEventListener(OFFLINE_QUEUE_UPDATED_EVENT, onQueueUpdated as EventListener)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      window.removeEventListener(OFFLINE_QUEUE_UPDATED_EVENT, onQueueUpdated as EventListener)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar — hidden on mobile, shown on md+ */}
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col border-r border-border bg-card">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-border">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center flex-shrink-0">
            <span className="font-display text-background text-base leading-none">T</span>
          </div>
          <div>
            <p className="font-display text-lg tracking-wider leading-none">TRADE REFLECTION</p>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">v{version}</p>
          </div>
        </div>

        {/* Account Balance Card */}
        <div className="px-3 pt-3 pb-2">
          <AccountBalanceCard totalPnL={stats.total_pnl} />
        </div>

        {/* New Trade CTA */}
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={() => navigate('/trades/new')}
            className="w-full flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-3 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Log New Trade
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground px-2 pt-3 pb-1.5">
            Main
          </p>
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors group',
                  isActive
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-primary' : '')} />
                  <span>{label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto text-primary" />}
                </>
              )}
            </NavLink>
          ))}

          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground px-2 pt-5 pb-1.5">
            Coming in M3
          </p>
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground/40 cursor-not-allowed">
            <Zap className="w-4 h-4 flex-shrink-0" />
            <span>AI Grader</span>
            <span className="ml-auto text-[10px] bg-accent px-1.5 py-0.5 rounded text-muted-foreground/60 font-mono">
              Soon
            </span>
          </div>
        </nav>

        {/* Bottom user section */}
        <div className="border-t border-border p-3 space-y-1">
          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>

          <div className="flex items-center gap-2.5 px-3 py-2 rounded-md">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={initials}
                className="w-7 h-7 rounded-full object-cover ring-1 ring-border"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary text-xs font-bold">{initials}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate leading-tight">
                {profile?.display_name ?? 'Trader'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
              {subscription?.tier && (
                <div className="mt-1">
                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded ${
                    subscription.tier === 'pro'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}>
                    {subscription.tier.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded hover:bg-destructive/20 hover:text-destructive transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-border bg-card/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile: show logo since sidebar is hidden */}
            <div className="flex items-center gap-2 md:hidden">
              <div className="w-7 h-7 rounded bg-primary flex items-center justify-center flex-shrink-0">
                <span className="font-display text-background text-base leading-none">T</span>
              </div>
              <span className="font-display text-sm tracking-wider leading-none hidden sm:inline">TRADE REFLECTION</span>
            </div>
            {/* Account Selector */}
            <AccountSelector onManageClick={() => setAccountsModalOpen(true)} />
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1
                return (
                  <div key={crumb.to} className="flex items-center gap-1">
                    {index > 0 && <span className="text-muted-foreground/60">/</span>}
                    <button
                      type="button"
                      onClick={() => navigate(crumb.to)}
                      className={cn(
                        'transition-colors',
                        isLast ? 'text-foreground font-medium cursor-default' : 'hover:text-foreground'
                      )}
                      disabled={isLast}
                    >
                      {crumb.label}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingSyncCount > 0 && (
              <div
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded border border-amber-500/40 bg-amber-500/10 text-[11px] text-amber-300"
                title={`${pendingSyncCount} queued change${pendingSyncCount === 1 ? '' : 's'} waiting to sync`}
              >
                <span className="inline-flex w-2 h-2 rounded-full bg-amber-400" />
                <span>Pending Sync: {pendingSyncCount}</span>
              </div>
            )}

            {failedSyncCount > 0 && (
              <div
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded border border-destructive/50 bg-destructive/10 text-[11px] text-destructive"
                title={failedSyncSummary ?? `${failedSyncCount} sync issue${failedSyncCount === 1 ? '' : 's'} detected`}
              >
                <span className="inline-flex w-2 h-2 rounded-full bg-destructive" />
                <span>Sync Issues: {failedSyncCount}</span>
              </div>
            )}

            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded border border-border/60 text-[11px] text-muted-foreground"
              title={`Realtime: ${realtime.text} • ${realtime.lastSyncedLabel} • ${realtime.subscriptionCount} subscriptions`}
            >
              <span className={cn('w-2 h-2 rounded-full', realtime.color)} />
              <Wifi className="w-3 h-3" />
              <span>{realtime.text}</span>
              <span className="text-muted-foreground/80">• {realtime.lastSyncedLabel}</span>
            </div>

            {/* Install App button — only shown when browser supports PWA install */}
            {canInstall && (
              <button
                type="button"
                onClick={install}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary/40 text-xs text-primary hover:bg-primary/10 transition-colors"
                title="Install Trade Reflection as an app"
              >
                <MonitorDown className="w-3.5 h-3.5" />
                <span>Install App</span>
              </button>
            )}

            {!canInstall && !isInstalled && installHelpText && (
              <button
                type="button"
                onClick={() => setShowInstallHelp((v) => !v)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                title="How to install this app"
              >
                <MonitorDown className="w-3.5 h-3.5" />
                <span>Install Help</span>
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((v) => !v)}
                className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 inline-flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] font-mono text-primary-foreground">
                    {Math.min(notifications.length, 9)}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-md border border-border bg-card shadow-lg z-40">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                      Notifications
                    </span>
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={() => clearAllNotifications()}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="px-3 py-4 text-[11px] text-muted-foreground">
                      No recent activity yet.
                    </div>
                  ) : (
                    <ul className="max-h-72 overflow-y-auto py-1">
                      {notifications.map((n) => (
                        <li
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className="px-3 py-2 border-b border-border/50 last:border-b-0 cursor-pointer hover:bg-accent/40 transition-colors"
                        >
                          <p className="text-[11px] font-medium leading-tight truncate">
                            {n.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {showInstallHelp && installHelpText && (
          <div className="px-4 md:px-6 py-2 border-b border-border bg-accent/30 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{installHelpText}</p>
            <button
              type="button"
              onClick={() => setShowInstallHelp(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        )}

        {failedSyncCount > 0 && (
          <div className="px-4 md:px-6 py-2 border-b border-destructive/30 bg-destructive/10 flex items-center justify-between gap-3">
            <p className="text-xs text-destructive/90">
              {failedSyncSummary ?? `${failedSyncCount} queued change${failedSyncCount === 1 ? '' : 's'} failed to sync.`}
            </p>
            <button
              type="button"
              onClick={handleRetrySync}
              disabled={!isOnline}
              className="text-xs px-2.5 py-1 rounded border border-destructive/50 text-destructive hover:bg-destructive/10 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* Offline indicator */}
        {!isOnline && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-950/70 border-b border-amber-700/40 flex-shrink-0">
            <WifiOff className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-xs text-amber-300">You're offline — showing cached data</span>
          </div>
        )}

        {/* Page content — pb-16 on mobile to clear the bottom tab bar */}
        <main className="flex-1 overflow-y-auto flex flex-col pb-16 md:pb-0">
          <Outlet />
          <Footer />
        </main>

        {/* Global in-app notifications */}
        <NotificationToaster />
      </div>

      {/* Mobile bottom tab navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden bg-card border-t border-border safe-area-inset-bottom">
        {MOBILE_NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
                <span className="font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Manage Accounts Modal */}
      <ManageAccountsModal isOpen={accountsModalOpen} onClose={() => setAccountsModalOpen(false)} />

      {/* Session Timeout Warning */}
      <SessionTimeoutWarning />
    </div>
  )
}
