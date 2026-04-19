import { useEffect, useState } from 'react'
import { Search, Loader2, Check, X, Shield, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

interface UserSubscriptionInfo {
  user_id: string
  email: string
  tier: string
  status: string
  start_date: string
  renewal_date: string | null
  trial_end_date: string | null
  created_at: string
  has_stripe_sub: boolean
}

export function AdminDashboardPage() {
  const { user } = useAuthStore()
  const [searchEmail, setSearchEmail] = useState('')
  const [users, setUsers] = useState<UserSubscriptionInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Simple admin check - check email domain
  const isAdmin = user?.email?.endsWith('@admin.stock-journal.com') || user?.email === 'bdesai2@gmail.com'

  const searchUsers = async (email: string = searchEmail) => {
    if (!email.trim()) {
      setUsers([])
      return
    }

    setLoading(true)
    try {
      console.log('Searching for users with email:', email)
      // Call Supabase function to search users
      const { data, error } = await supabase
        .rpc('get_user_subscription_info', {
          search_email: email,
        })

      console.log('Search response:', { data, error })

      if (error) {
        console.error('RPC error:', error)
        throw error
      }

      setUsers(data || [])
      setMessage(null)
    } catch (err) {
      console.error('Search error:', err)
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to search users',
      })
    } finally {
      setLoading(false)
    }
  }

  const grantProAccess = async (userId: string) => {
    setUpdating(userId)
    try {
      console.log('Granting pro access to user:', userId)
      const { data, error } = await supabase.rpc('grant_pro_access', {
        target_user_id: userId,
        notes: `Granted by ${user?.email} on ${new Date().toISOString()}`,
      })

      console.log('Grant response:', { data, error })

      if (error) {
        console.error('Grant error:', error)
        throw error
      }

      setMessage({
        type: 'success',
        text: `Pro access granted to ${data.user_id}`,
      })

      // Refresh user list with current search email
      await searchUsers(searchEmail)
    } catch (err) {
      console.error('Grant pro access error:', err)
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to grant pro access',
      })
    } finally {
      setUpdating(null)
    }
  }

  const revokeProAccess = async (userId: string) => {
    if (!window.confirm('Are you sure you want to revoke Pro access? This will downgrade the user to Free tier.')) {
      return
    }

    setUpdating(userId)
    try {
      console.log('Revoking pro access from user:', userId)
      const { data, error } = await supabase.rpc('revoke_pro_access', {
        target_user_id: userId,
        notes: `Revoked by ${user?.email} on ${new Date().toISOString()}`,
      })

      console.log('Revoke response:', { data, error })

      if (error) {
        console.error('Revoke error:', error)
        throw error
      }

      setMessage({
        type: 'success',
        text: `Pro access revoked for ${data.user_id}`,
      })

      // Refresh user list with current search email
      await searchUsers(searchEmail)
    } catch (err) {
      console.error('Revoke pro access error:', err)
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to revoke pro access',
      })
    } finally {
      setUpdating(null)
    }
  }

  // Auto-search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchEmail.trim()) {
        searchUsers(searchEmail)
      } else {
        setUsers([])
        setMessage(null)
      }
    }, 500) // Wait 500ms after user stops typing

    return () => clearTimeout(timer)
  }, [searchEmail])

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-destructive mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            Admin dashboard is restricted to administrators only.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 animate-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-display tracking-wider">ADMIN DASHBOARD</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Manage user subscriptions and grant Pro access
        </p>
      </div>

      {/* Search Section */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Search Users by Email
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchUsers(searchEmail)}
                  placeholder="Enter email to search (searches as you type)..."
                  className="w-full pl-9 pr-3 py-2 rounded border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                onClick={() => searchUsers(searchEmail)}
                disabled={loading}
                className="px-4 py-2 rounded border border-primary/60 bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </button>
            </div>
          </div>

          {message && (
            <div
              className={`px-3 py-2 rounded text-sm ${
                message.type === 'success'
                  ? 'bg-emerald-950/30 border border-emerald-500/40 text-emerald-400'
                  : 'bg-destructive/10 border border-destructive/40 text-destructive'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {users.length > 0 ? (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Tier</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Renewal Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Joined</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((userSub) => (
                  <tr key={userSub.user_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{userSub.email}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{userSub.user_id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          userSub.tier === 'pro'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}
                      >
                        {userSub.tier ? userSub.tier.toUpperCase() : 'FREE'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-mono ${
                          userSub.status === 'active'
                            ? 'text-emerald-400'
                            : userSub.status === 'trialing'
                            ? 'text-blue-400'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {userSub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground font-mono">
                      {userSub.renewal_date ? new Date(userSub.renewal_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground font-mono">
                      {new Date(userSub.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {(userSub.tier === 'free' || !userSub.tier) ? (
                          <button
                            onClick={() => grantProAccess(userSub.user_id)}
                            disabled={updating === userSub.user_id}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded text-[11px] font-medium border border-emerald-500/40 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-950/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {updating === userSub.user_id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            Grant Pro
                          </button>
                        ) : (
                          <button
                            onClick={() => revokeProAccess(userSub.user_id)}
                            disabled={updating === userSub.user_id}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded text-[11px] font-medium border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {updating === userSub.user_id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <X className="w-3 h-3" />
                            )}
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : searchEmail.trim() && !loading ? (
        <div className="rounded-lg border border-border bg-card/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">No users found matching "{searchEmail}"</p>
        </div>
      ) : null}

      {/* Info Section */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">ℹ How to use:</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>Start typing an email address - search results appear automatically</li>
          <li>Press Enter to search immediately (without waiting for the 500ms delay)</li>
          <li>Click "Grant Pro" to upgrade a free user to Pro tier</li>
          <li>Click "Revoke" to downgrade a Pro user back to Free tier</li>
          <li>All actions are logged in the subscription_logs table</li>
        </ul>
      </div>
    </div>
  )
}
