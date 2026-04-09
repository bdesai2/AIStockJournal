import { useState } from 'react'
import { PlusCircle, Trash2, TrendingUp, TrendingDown, Edit2 } from 'lucide-react'
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
  const { addExecution, updateExecution, deleteExecution } = useTradeStore()

  const [adding, setAdding] = useState(false)
  const [addingDividend, setAddingDividend] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    action: 'buy' as 'buy' | 'sell',
    datetime: nowLocal(),
    quantity: '',
    price: '',
    fee: '',
    dividend: '',
  })
  const [dividendForm, setDividendForm] = useState({
    datetime: nowLocal(),
    dividend: '',
  })

  const [editForm, setEditForm] = useState({
    action: 'buy' as 'buy' | 'sell',
    datetime: nowLocal(),
    quantity: '',
    price: '',
    fee: '',
    dividend: '',
  })

  const executions: TradeExecution[] = [...(trade.executions ?? [])].sort(
    (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
  )

  const summary = calcExecutionsSummary(executions, trade.asset_type as AssetType)

  const totalBought = executions
    .filter((e) => e.action === 'buy')
    .reduce((s, e) => s + e.quantity, 0)
  const totalSold = executions
    .filter((e) => e.action === 'sell')
    .reduce((s, e) => s + e.quantity, 0)
  const totalDividend = executions
    .reduce((s, e) => s + (e.dividend ?? 0), 0)

  const handleSave = async () => {
    if (!user?.id || !form.quantity || !form.price) return
    setSaving(true)
    setError(null)
    const success = await addExecution(user.id, trade.id, {
      action: form.action,
      datetime: new Date(form.datetime).toISOString(),
      quantity: parseFloat(form.quantity),
      price: parseFloat(form.price),
      fee: form.fee ? parseFloat(form.fee) : 0,
      dividend: form.dividend ? parseFloat(form.dividend) : 0,
    })
    setSaving(false)
    if (success) {
      setAdding(false)
      setForm({ action: 'buy', datetime: nowLocal(), quantity: '', price: '', fee: '', dividend: '' })
    } else {
      setError('Failed to save execution. Check console for details.')
    }
  }

  const handleSaveDividend = async () => {
    if (!user?.id || !dividendForm.dividend) return
    setSaving(true)
    setError(null)
    const success = await addExecution(user.id, trade.id, {
      action: 'buy',
      datetime: new Date(dividendForm.datetime).toISOString(),
      quantity: 0,
      price: 0,
      fee: 0,
      dividend: parseFloat(dividendForm.dividend),
    })
    setSaving(false)
    if (success) {
      setAddingDividend(false)
      setDividendForm({ datetime: nowLocal(), dividend: '' })
    } else {
      setError('Failed to save dividend. Check console for details.')
    }
  }

  const startEdit = (exec: TradeExecution) => {
    const d = new Date(exec.datetime)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    const local = d.toISOString().slice(0, 16)
    setEditingId(exec.id)
    setError(null)
    setEditForm({
      action: exec.action,
      datetime: local,
      quantity: exec.quantity ? String(exec.quantity) : '',
      price: exec.price ? String(exec.price) : '',
      fee: exec.fee != null ? String(exec.fee) : '',
      dividend: exec.dividend != null ? String(exec.dividend) : '',
    })
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    if (!editForm.datetime) return
    setSaving(true)
    setError(null)

    const patch: Partial<Pick<TradeExecution, 'action' | 'datetime' | 'quantity' | 'price' | 'fee' | 'dividend'>> = {
      action: editForm.action,
      datetime: new Date(editForm.datetime).toISOString(),
      quantity: editForm.quantity ? parseFloat(editForm.quantity) : 0,
      price: editForm.price ? parseFloat(editForm.price) : 0,
      fee: editForm.fee ? parseFloat(editForm.fee) : 0,
      dividend: editForm.dividend ? parseFloat(editForm.dividend) : 0,
    }

    const success = await updateExecution(editingId, trade.id, patch)
    setSaving(false)
    if (success) {
      setEditingId(null)
    } else {
      setError('Failed to update execution. Check console for details.')
    }
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
        <div className="flex gap-2">
          {!adding && !addingDividend && (
            <>
              <button
                onClick={() => setAdding(true)}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Add Execution
              </button>
              <button
                onClick={() => setAddingDividend(true)}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Add Dividend
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Add dividend form */}
        {addingDividend && (
          <div className="rounded-md border border-border/60 bg-accent/20 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Record dividend received</p>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 px-2 py-1.5 rounded">{error}</p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground block mb-1">Date / Time</label>
                <input
                  type="datetime-local"
                  value={dividendForm.datetime}
                  onChange={(e) => setDividendForm((f) => ({ ...f, datetime: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground block mb-1">Dividend Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={dividendForm.dividend}
                  onChange={(e) => setDividendForm((f) => ({ ...f, dividend: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSaveDividend}
                disabled={saving || !dividendForm.dividend}
                className="flex-1 bg-primary text-primary-foreground rounded-md py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setAddingDividend(false)
                  setError(null)
                }}
                className="px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Add execution form */}
        {adding && !editingId && (
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

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 px-2 py-1.5 rounded">{error}</p>
            )}

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
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Dividend</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.dividend}
                  onChange={(e) => setForm((f) => ({ ...f, dividend: e.target.value }))}
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
                onClick={() => {
                  setAdding(false)
                  setError(null)
                }}
                className="px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Execution rows */}
        {executions.length === 0 && !adding && !editingId && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No executions logged. Add buys and sells to track P&L.
          </p>
        )}

        {executions.length > 0 && (
          <>
            {/* Column headers */}
            {!editingId && (
              <div className="grid grid-cols-[80px_1fr_80px_80px_60px_80px_72px] gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-1">
                <span>Action</span>
                <span>Date / Time</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Price</span>
                <span className="text-right">Fee</span>
                <span className="text-right">Dividend</span>
                <span className="text-right">Actions</span>
              </div>
            )}

            {executions.map((exec) => {
              const isDividendOnly = exec.quantity === 0 && exec.price === 0 && (exec.dividend ?? 0) > 0
              const isEditing = editingId === exec.id

              if (isEditing) {
                return (
                  <div
                    key={exec.id}
                    className="grid grid-cols-[80px_1fr_80px_80px_60px_80px_120px] gap-2 items-center px-1 py-2 rounded bg-accent/30"
                  >
                    {/* Action toggle */}
                    <div className="flex gap-1">
                      {(['buy', 'sell'] as const).map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => setEditForm((f) => ({ ...f, action: a }))}
                          className={cn(
                            'flex-1 py-1 rounded text-[10px] font-semibold border transition-colors uppercase',
                            editForm.action === a
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
                    <input
                      type="datetime-local"
                      value={editForm.datetime}
                      onChange={(e) => setEditForm((f) => ({ ...f, datetime: e.target.value }))}
                      className={cn(inputClass, 'text-[11px] px-1.5 py-1')}
                    />
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={editForm.quantity}
                      onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))}
                      className={cn(inputClass, 'text-[11px] px-1.5 py-1 text-right')}
                    />
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={editForm.price}
                      onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                      className={cn(inputClass, 'text-[11px] px-1.5 py-1 text-right')}
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.fee}
                      onChange={(e) => setEditForm((f) => ({ ...f, fee: e.target.value }))}
                      className={cn(inputClass, 'text-[11px] px-1.5 py-1 text-right')}
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.dividend}
                      onChange={(e) => setEditForm((f) => ({ ...f, dividend: e.target.value }))}
                      className={cn(inputClass, 'text-[11px] px-1.5 py-1 text-right')}
                    />
                    <div className="flex gap-1 justify-end">
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={saving}
                        className="px-2 py-1 text-[11px] rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null)
                          setError(null)
                        }}
                        className="px-2 py-1 text-[11px] rounded text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={exec.id}
                  className={cn(
                    'grid gap-2 items-center px-1 py-1 rounded hover:bg-accent/30 transition-colors',
                    isDividendOnly
                      ? 'grid-cols-[80px_1fr_1fr_72px]'
                      : 'grid-cols-[80px_1fr_80px_80px_60px_80px_72px]'
                  )}
                >
                  <span
                    className={cn(
                      'text-xs font-semibold font-mono px-2 py-0.5 rounded w-fit uppercase',
                      isDividendOnly
                        ? 'bg-[#00d4a1]/15 text-[#00d4a1]'
                        : exec.action === 'buy'
                        ? 'bg-[#00d4a1]/15 text-[#00d4a1]'
                        : 'bg-[#ff4d6d]/15 text-[#ff4d6d]'
                    )}
                  >
                    {isDividendOnly ? (
                      'DIV'
                    ) : exec.action === 'buy' ? (
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

                  {isDividendOnly ? (
                    <span className="text-xs font-mono text-right font-bold text-[#00d4a1]">
                      +{fmt.currency(exec.dividend)}
                    </span>
                  ) : (
                    <>
                      <span className="text-xs font-mono text-right">{exec.quantity}</span>
                      <span className="text-xs font-mono text-right">{fmt.currency(exec.price, 4)}</span>
                      <span className="text-xs font-mono text-right text-muted-foreground">
                        {exec.fee ? fmt.currency(exec.fee) : '—'}
                      </span>
                      <span className="text-xs font-mono text-right text-muted-foreground">
                        {exec.dividend ? fmt.currency(exec.dividend) : '—'}
                      </span>
                    </>
                  )}

                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(exec)}
                      className="p-1 rounded text-muted-foreground/60 hover:text-primary hover:bg-accent/60 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(exec.id)}
                      disabled={deleting === exec.id}
                      className="p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}

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
              {totalDividend > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Dividends Paid</span>
                  <span className="text-base font-mono font-bold text-[#00d4a1]">
                    +{fmt.currency(totalDividend)}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
