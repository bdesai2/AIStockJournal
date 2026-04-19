import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export function AuthLayout() {
  const { user, initialized } = useAuthStore()

  if (initialized && user) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-border relative overflow-hidden">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Glow */}
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <span className="font-display text-background text-lg leading-none">T</span>
            </div>
            <span className="font-display text-2xl tracking-wider">TRADE REFLECTION</span>
          </div>
          <p className="text-muted-foreground text-sm">AI-Powered Trade Journal</p>
        </div>

        <div className="relative space-y-8">
          {[
            { label: 'Win Rate', value: '68.4%', color: 'text-[#00d4a1]' },
            { label: 'Total P&L', value: '+$24,180', color: 'text-[#00d4a1]' },
            { label: 'Avg R-Multiple', value: '+2.1R', color: 'text-[#00d4a1]' },
            { label: 'Trades This Month', value: '47', color: 'text-foreground' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between border-b border-border/50 pb-3">
              <span className="text-muted-foreground text-sm">{label}</span>
              <span className={`font-mono font-medium ${color}`}>{value}</span>
            </div>
          ))}
          <p className="text-muted-foreground/60 text-xs">
            Sample metrics — your data will appear once you start journaling.
          </p>
        </div>

        <div className="relative">
          <blockquote className="text-sm text-muted-foreground italic border-l-2 border-primary/40 pl-4">
            "The journal is the mirror. The trade is the test."
          </blockquote>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
