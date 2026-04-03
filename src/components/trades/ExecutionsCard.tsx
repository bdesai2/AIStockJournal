import { useState } from 'react'
import { PlusCircle, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useTradeStore } from '@/store/tradeStore'
import { calcExecutionsSummary, fmt, pnlColor } from '@/lib/tradeUtils'
import { cn } from '@/lib/utils'
import type { Trade, TradeExecution, AssetType } from '@/types'

interface Props {
  trade: Trade
}

const inputClass =
  'w-full bg-input border border-border rounded-md px-2.5 py-1.5 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary'

function nowLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function ExecutionsCard({ trade }: Props) {
  const { user } = useAuthStore()
  const { addExecution, deleteExecution } = useTradeStore()

  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm] = useState({
    action: 'buy' as 'buy' | 'sell',
    datetime: nowLocal(),
    quantity: '',
    price: '',
    fee: '',
  })

  const executions: TradeExecution[] = [...(trade.executions ?? [])].sort(
    (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
  )

  const summary = calcExecutionsSummary(executions, trade.asset_type as AssetType)

  const totalBought = executions
    .filter((e) => e.action === 'buy')
    .reduce((s, e) => s + e.quantity, 0)
  const totalSold = executions
    .filter((e) => e.action === 'sell')
    .reduce((s, e) => s + e.quantity, 0)

  const handleSave = async () => {
    if (!user?.id || !form.quantity || !form.price) return
    setSaving(true)
    await addExecution(user.id, trade.id, {
      action: form.action,
      datetime: new Date(form.datetime).toISOString(),
      quantity: parseFloat(form.quantity),
      price: parseFloat(form.price),
      fee: form.fee ? parseFloat(form.fee) : 0,
    })
    setSaving(false)
    setAdding(false)
    setForm({ action: 'buy', datetime: nowLocal(), quantity: '', price: '', fee: '' })
  }

  const handleDelete = async (execId: string) => {
    setDeleting(execId)
    await deleteExecution(execId, trade.id)
    setDeleting(null)
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Executions
          </span>
          {executions.length > 0 && (
            <span
              className={cn(
                'text-[10px] font-mono px-1.5 py-0.5 rounded',
                summary.status === 'closed'
                  ? 'bg-accent text-muted-foreground'
                  : summary.status === 'partial'
                  ? 'bg-blue-400/10 text-blue-400'
                  : 'bg-[#f0b429]/10 text-[#f0b429]'
              )}
            >
              {summary.status.toUpperCase()} · {totalBought - totalSold} open
            </span>
          )}
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Add execution form */}
        {adding && (
          <div className="rounded-md border border-border/60 bg-accent/20 p-3 space-y-3">
            {/* Buy / Sell toggle */}
            <div className="flex gap-2">
              {(['buy', 'sell'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, action: a }))}
                  className={cn(
                    'flex-1 py-1.5 rounded text-xs font-semibold border transition-colors uppercase',
                    form.action === a
                      ? a === 'buy'
                        ? 'bg-[#00d4a1]/20 border-[#00d4a1]/50 text-[#00d4a1]'
                        : 'bg-[#ff4d6d]/20 border-[#ff4d6d]/50 text-[#ff4d6d]'
                      : 'bg-transparent border-border text-muted-foreground hover:border-foreground/30'
                  )}
                >
                  {a}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground block mb-1">Date / Time</label>
                <input
                  type="datetime-local"
                  value={form.datetime}
                  onChange={(e) => setForm((f) => ({ ...f, datetime: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Quantity</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="100"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Price</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="0.00"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Fee</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.fee}
                  onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving || !form.quantity || !form.price}
                className="flex-1 bg-primary text-primary-foreground rounded-md py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setAdding(false)}
                className="px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Execution rows */}
        {executions.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No executions logged. Add buys and sells to track P&L.
          </p>
        )}

        {executions.length > 0 && (
          <>
            {/* Column headers */}
            <div className="grid grid-cols-[80px_1fr_80px_80px_60px_32px] gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-1">
              <span>Action</span>
              <span>Date / Time</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Price</span>
              <span className="text-right">Fee</span>
              <span />
            </div>

            {executions.map((exec) => (
              <div
                key={exec.id}
                className="grid grid-cols-[80px_1fr_80px_80px_60px_32px] gap-2 items-center px-1 py-1 rounded hover:bg-accent/30 transition-colors"
              >
                <span
                  className={cn(
                    'text-xs font-semibold font-mono px-2 py-0.5 rounded w-fit uppercase',
                    exec.action === 'buy'
                      ? 'bg-[#00d4a1]/15 text-[#00d4a1]'
                      : 'bg-[#ff4d6d]/15 text-[#ff4d6d]'
                  )}
                >
                  {exec.action === 'buy' ? (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> BUY
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" /> SELL
                    </span>
                  )}
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  {new Date(exec.datetime).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="text-xs font-mono text-right">{exec.quantity}</span>
                <span className="text-xs font-mono text-right">{fmt.currency(exec.price, 4)}</span>
                <span className="text-xs font-mono text-right text-muted-foreground">
                  {exec.fee ? fmt.currency(exec.fee) : '—'}
                </span>
                <button
                  onClick={() => handleDelete(exec.id)}
                  disabled={deleting === exec.id}
                  className="p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Summary row */}
            <div className="border-t border-border/60 pt-3 mt-1 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-muted-foreground">
                  Bought {totalBought} · Sold {totalSold} · Open {totalBought - totalSold}
                </span>
                <span className="text-muted-foreground">
                  Avg cost: {summary.avgCostBasis > 0 ? fmt.currency(summary.avgCostBasis, 4) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Realized P&L</span>
                <span className={cn('text-base font-mono font-bold', pnlColor(summary.realizedPnl))}>
                  {summary.realizedPnl >= 0 ? '+' : ''}{fmt.currency(summary.realizedPnl)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
