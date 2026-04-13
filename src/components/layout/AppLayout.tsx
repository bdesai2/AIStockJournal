import { useEffect, useMemo, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
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
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useTradeStore } from '@/store/tradeStore'
import { auth } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { NotificationToaster } from '@/components/notifications/NotificationToaster'
import { useNotificationStore, type Notification } from '@/store/notificationStore'
import { aggregateStats, fmt, pnlColor } from '@/lib/tradeUtils'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/trades', icon: LineChart, label: 'Trades' },
  { to: '/journal', icon: BookOpen, label: 'Journal' },
  { to: '/strategies', icon: Zap, label: 'Strategies' },
]

export function AppLayout() {
  const { user, profile } = useAuthStore()
  const { trades, fetchTrades } = useTradeStore()
  const navigate = useNavigate()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const notifications = useNotificationStore((s) => s.notifications)
  const clearAllNotifications = useNotificationStore((s) => s.clearAll)

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
    if (user?.id && trades.length === 0) {
      fetchTrades(user.id)
    }
  }, [user?.id, trades.length, fetchTrades])

  const stats = useMemo(() => aggregateStats(trades), [trades])
  const winRatePercent = stats.total_trades > 0 ? stats.win_rate * 100 : 0
  const profitFactorDisplay = !Number.isFinite(stats.profit_factor)
    ? '∞'
    : stats.profit_factor.toFixed(2)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col border-r border-border bg-card">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-border">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center flex-shrink-0">
            <span className="font-display text-background text-base leading-none">S</span>
          </div>
          <div>
            <p className="font-display text-lg tracking-wider leading-none">STONKJOURNAL</p>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">v{version} · M3</p>
          </div>
        </div>

        {/* Account snapshot */}
        <div className="px-3 pt-3 pb-2 border-b border-border/60">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground px-1 mb-1.5">
            Overview
          </p>
          <div className="space-y-1.5 text-[11px] font-mono">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total P&L</span>
              <span className={pnlColor(stats.total_pnl)}>{fmt.currency(stats.total_pnl)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Win rate</span>
              <span>{winRatePercent.toFixed(0)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Profit factor</span>
              <span>{stats.total_trades > 0 ? profitFactorDisplay : '—'}</span>
            </div>
          </div>
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
        <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-card/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Breadcrumb injected by pages via context if needed */}
          </div>
          <div className="flex items-center gap-2">
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

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Global in-app notifications */}
        <NotificationToaster />
      </div>
    </div>
  )
}
