import { Outlet, NavLink, useNavigate } from 'react-router-dom'
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
import { auth } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/trades', icon: LineChart, label: 'Trades' },
  { to: '/journal', icon: BookOpen, label: 'Journal' },
]

export function AppLayout() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await auth.signOut()
    navigate('/auth/login')
  }

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?'

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
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">v0.1.0 · M1</p>
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-card/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Breadcrumb injected by pages via context if needed */}
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
