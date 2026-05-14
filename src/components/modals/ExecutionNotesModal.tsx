import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { Trade } from '@/types'
import { useTradeStore } from '@/store/tradeStore'

interface ExecutionNotesModalProps {
  isOpen: boolean
  onClose: () => void
  trade: Trade
}

export function ExecutionNotesModal({ isOpen, onClose, trade }: ExecutionNotesModalProps) {
  const { updateTrade } = useTradeStore()
  const [notes, setNotes] = useState(trade.execution_notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const ok = await updateTrade(trade.id, { execution_notes: notes || undefined })

    setSaving(false)

    if (ok) {
      onClose()
    } else {
      setError('Failed to save execution notes')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full sm:max-w-2xl rounded-lg overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-lg font-display tracking-wider">Execution Notes</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {trade.ticker} · {trade.direction.toUpperCase()} · {trade.status === 'closed' ? 'Closed' : 'Open'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive mb-4">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground block">
              Execution Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about how this trade was executed, any issues encountered, trade management decisions, etc."
              rows={10}
              autoCapitalize="sentences"
              spellCheck
              className="w-full rounded-md bg-background border border-border px-3 py-2 text-sm placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 px-6 py-3 border-t border-border/60 bg-card/95 backdrop-blur-sm flex gap-2 justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Save Notes
          </button>
        </div>
      </div>
    </div>
  )
}
