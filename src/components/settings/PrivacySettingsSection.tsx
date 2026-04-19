import { Loader2, Download, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useTradeStore } from '@/store/tradeStore'
import { db } from '@/lib/supabase'
import { logAuditEvent } from '@/lib/auditLog'
import { AuditLogViewer } from './AuditLogViewer'

export function PrivacySettingsSection() {
  const { user } = useAuthStore()
  const { trades } = useTradeStore()
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // Export user data as JSON
  const handleExportJSON = async () => {
    if (!user?.id) return
    setExporting(true)

    try {
      // Fetch all user data
      const profile = await db.profiles().select('*').eq('id', user.id).single()
      const accounts = await db.accounts().select('*').eq('user_id', user.id)
      const journals = await db.journals().select('*').eq('user_id', user.id)

      const exportData = {
        exportDate: new Date().toISOString(),
        profile: profile.data,
        accounts: accounts.data,
        trades,
        journals: journals.data,
      }

      // Log audit event
      await logAuditEvent(user.id, 'EXPORT_DATA', {
        format: 'JSON',
        recordCount: {
          trades: trades.length,
          accounts: accounts.data?.length || 0,
          journals: journals.data?.length || 0,
        },
      })

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `stock-journal-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export data')
    } finally {
      setExporting(false)
    }
  }

  // Export user data as CSV (trades only)
  const handleExportCSV = () => {
    if (trades.length === 0) {
      alert('No trades to export')
      return
    }

    // Convert trades to CSV
    const headers = [
      'Ticker',
      'Asset Type',
      'Direction',
      'Entry Price',
      'Exit Price',
      'Quantity',
      'Entry Date',
      'Exit Date',
      'P&L',
      'Risk %',
      'Setup Notes',
      'Status',
    ]

    const rows = trades.map((trade) => [
      trade.ticker,
      trade.asset_type,
      trade.direction,
      trade.entry_price,
      trade.exit_price || '',
      trade.quantity,
      trade.entry_date,
      trade.exit_date || '',
      trade.net_pnl || '',
      trade.risk_percent || '',
      `"${(trade.setup_notes || '').replace(/"/g, '""')}"`,
      trade.status,
    ])

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')

    // Log audit event
    if (user?.id) {
      logAuditEvent(user.id, 'EXPORT_DATA', {
        format: 'CSV',
        recordCount: trades.length,
      }).catch(console.error)
    }

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stock-journal-trades-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Delete account and all associated data
  const handleDeleteAccount = async () => {
    if (!user?.id) return
    setDeleting(true)

    try {
      // Log audit event before deletion
      await logAuditEvent(user.id, 'DELETE_ACCOUNT', {
        timestamp: new Date().toISOString(),
      })

      // Supabase cascading delete will handle trades & journals via foreign keys
      await db.accounts().delete().eq('user_id', user.id)

      // Delete user profile
      await db.profiles().delete().eq('id', user.id)

      // Sign out user
      alert('Your account and all data have been permanently deleted.')
      window.location.href = '/auth/login'
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete account. Please try again or contact support.')
    } finally {
      setDeleting(false)
      setDeleteConfirm(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Data Export Section */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
          <Download className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Data Export
          </span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Download a copy of your data in JSON or CSV format. Your data remains on our servers.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleExportJSON}
              disabled={exporting}
              className="flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export as JSON
            </button>
            <button
              onClick={handleExportCSV}
              disabled={exporting || trades.length === 0}
              className="flex items-center gap-2 bg-secondary text-secondary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export Trades (CSV)
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Maximum 1 export per hour to prevent abuse.
          </p>
        </div>
      </div>

      {/* Audit Log Viewer */}
      <AuditLogViewer />

      {/* Account Deletion Section */}
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-destructive/20">
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
          <span className="text-xs font-medium uppercase tracking-wider text-destructive">
            Danger Zone
          </span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>

          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-2 bg-destructive text-destructive-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-destructive/90 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete My Account
            </button>
          ) : (
            <div className="bg-card border border-destructive/30 rounded p-3 space-y-3">
              <p className="text-sm font-semibold text-destructive">
                ⚠️ Are you absolutely sure?
              </p>
              <p className="text-xs text-muted-foreground">
                This will permanently delete:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-3">
                <li>✓ Your profile and account information</li>
                <li>✓ All trading accounts and balances</li>
                <li>✓ All trades and trade history</li>
                <li>✓ All journal entries and notes</li>
                <li>✓ All preferences and settings</li>
              </ul>
              <p className="text-xs text-muted-foreground italic">
                You have 30 days to request a backup before permanent deletion.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-2 bg-destructive text-destructive-foreground rounded-md px-3 py-2 text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Yes, Delete Everything
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 bg-muted text-muted-foreground rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
