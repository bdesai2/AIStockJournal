import { Loader2, Download, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { AuditLogViewer } from './AuditLogViewer'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

type PrivacyExportJsonResponse = {
  fileName: string
  payload: unknown
}

type PrivacyExportCsvResponse = {
  fileName: string
  csv: string
}

async function postPrivacy<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  let { data: { session } } = await supabase.auth.getSession()

  if (session?.expires_at && session.expires_at * 1000 < Date.now()) {
    const { data } = await supabase.auth.refreshSession()
    session = data.session
  }

  if (!session?.access_token) {
    throw new Error('Not authenticated. Please sign in again.')
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({})) as { error?: string }
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }

  return data as T
}

function downloadBlob(content: BlobPart, mimeType: string, fileName: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function PrivacySettingsSection() {
  const { user } = useAuthStore()
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')

  const handleExportJSON = async () => {
    if (!user?.id) return
    setExporting(true)

    try {
      const data = await postPrivacy<PrivacyExportJsonResponse>('/api/privacy/export-json')
      downloadBlob(JSON.stringify(data.payload, null, 2), 'application/json', data.fileName)
    } catch (error) {
      console.error('Export JSON error:', error)
      alert(error instanceof Error ? error.message : 'Failed to export JSON data')
    } finally {
      setExporting(false)
    }
  }

  const handleExportCSV = async () => {
    if (!user?.id) return
    setExporting(true)

    try {
      const data = await postPrivacy<PrivacyExportCsvResponse>('/api/privacy/export-csv')
      downloadBlob(data.csv, 'text/csv', data.fileName)
    } catch (error) {
      console.error('Export CSV error:', error)
      alert(error instanceof Error ? error.message : 'Failed to export CSV data')
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!user?.id) return
    setDeleting(true)

    try {
      await postPrivacy('/api/privacy/delete-account', { confirmationText: deleteText })
      await supabase.auth.signOut()
      alert('Your account and all data have been permanently deleted.')
      window.location.href = '/auth/login'
    } catch (error) {
      console.error('Delete error:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete account. Please try again later.')
    } finally {
      setDeleting(false)
      setDeleteConfirm(false)
      setDeleteText('')
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
              disabled={exporting}
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
              <p className="text-xs text-muted-foreground">
                Type <span className="font-semibold">DELETE</span> to confirm permanent removal.
              </p>
              <input
                type="text"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder="Type DELETE"
                disabled={deleting}
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
              />
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteText !== 'DELETE'}
                  className="flex-1 flex items-center justify-center gap-2 bg-destructive text-destructive-foreground rounded-md px-3 py-2 text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Yes, Delete Everything
                </button>
                <button
                  onClick={() => {
                    setDeleteConfirm(false)
                    setDeleteText('')
                  }}
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
