import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Image as ImageIcon, Loader2, PlusCircle, Trash2, Filter, Search, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { useSetupStore } from '@/store/setupStore'
import { useStrategyStore } from '@/store/strategyStore'
import { SetupRow } from '@/components/setups/SetupRow'
import { STRATEGY_TAG_LABELS, fmt } from '@/lib/tradeUtils'
import type { Setup, SetupProbability, StrategyTag, TradeDirection } from '@/types'
import { cn } from '@/lib/utils'

interface SetupFormState {
  name: string
  ticker: string
  direction: TradeDirection
  strategy_id: string
  reasons: string
  entry_price: number
  take_profit: number
  stop_loss: number
  probability: SetupProbability
  tags: StrategyTag[]
}

const EMPTY_FORM: SetupFormState = {
  name: '',
  ticker: '',
  direction: 'long',
  strategy_id: '',
  reasons: '',
  entry_price: 0,
  take_profit: 0,
  stop_loss: 0,
  probability: 'medium',
  tags: [],
}

const formatProbabilityLabel = (value: SetupProbability) => {
  if (value === 'low') return 'Low'
  if (value === 'high') return 'High'
  return 'Medium'
}

const calcRiskReward = (entry: number, stop: number, target: number) => {
  const risk = Math.abs(entry - stop)
  const reward = Math.abs(target - entry)
  if (!Number.isFinite(risk) || !Number.isFinite(reward) || risk <= 0) return null
  return reward / risk
}

export function SetupsPage() {
  const { user, loading: authLoading, initialized } = useAuthStore()
  const pushNotification = useNotificationStore((state) => state.push)
  const { strategies, fetchStrategies } = useStrategyStore()
  const {
    setups,
    loading,
    error,
    fetchSetups,
    createSetup,
    updateSetup,
    deleteSetup,
    uploadScreenshot,
    deleteScreenshot,
  } = useSetupStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>('view')
  const [form, setForm] = useState<SetupFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [closingSetup, setClosingSetup] = useState<Setup | null>(null)
  const [closeStatus, setCloseStatus] = useState<Setup['close_outcome']>('cancelled')
  const [closeNotes, setCloseNotes] = useState('')
  const [closing, setClosing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all')
  const authReady = initialized && !authLoading && !!user?.id
  const saveBlockedReason = !initialized || authLoading
    ? 'Authentication is still loading. Please wait a moment before saving.'
    : null

  useEffect(() => {
    if (user?.id) {
      fetchSetups(user.id)
      fetchStrategies(user.id)
    }
  }, [user?.id, fetchSetups, fetchStrategies])

  const strategyById = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of strategies) map.set(s.id, s.name)
    return map
  }, [strategies])

  const filteredSetups = useMemo(() => {
    let result = [...setups]

    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((s) => {
        const strategyName = s.strategy_id ? strategyById.get(s.strategy_id) ?? '' : ''
        return (
          s.name.toLowerCase().includes(q) ||
          s.ticker.toLowerCase().includes(q) ||
          strategyName.toLowerCase().includes(q) ||
          (s.reasons ?? '').toLowerCase().includes(q)
        )
      })
    }

    return result
  }, [setups, statusFilter, search, strategyById])

  const selectedSetup: Setup | undefined = useMemo(
    () => (selectedId ? setups.find((s) => s.id === selectedId) : undefined),
    [setups, selectedId]
  )

  useEffect(() => {
    if (mode !== 'create' && !selectedId && filteredSetups.length > 0) {
      setSelectedId(filteredSetups[0].id)
    }
  }, [filteredSetups, selectedId, mode])

  useEffect(() => {
    if (selectedSetup) {
      setForm({
        name: selectedSetup.name,
        ticker: selectedSetup.ticker,
        direction: selectedSetup.direction,
        strategy_id: selectedSetup.strategy_id ?? '',
        reasons: selectedSetup.reasons ?? '',
        entry_price: selectedSetup.entry_price,
        take_profit: selectedSetup.take_profit,
        stop_loss: selectedSetup.stop_loss,
        probability: selectedSetup.probability,
        tags: selectedSetup.tags ?? [],
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [selectedSetup?.id])

  const handleChange = (field: keyof SetupFormState, value: string | number | TradeDirection) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const toggleTag = (tag: StrategyTag) => {
    setForm((prev) => {
      const has = prev.tags.includes(tag)
      return {
        ...prev,
        tags: has ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
      }
    })
  }

  const startNew = () => {
    setEditingId(null)
    setSelectedId(null)
    setMode('create')
    setForm(EMPTY_FORM)
  }

  const handleSelect = (setup: Setup) => {
    setSelectedId(setup.id)
    setEditingId(null)
    setMode('view')
  }

  const handleSave = async () => {
    if (saveBlockedReason) {
      pushNotification({
        kind: 'error',
        variant: 'warning',
        title: 'Setup not saved',
        message: saveBlockedReason,
      })
      return
    }

    if (!form.name.trim()) return
    if (!form.ticker.trim()) return

    const currentUserId = user?.id

    if (!currentUserId) {
      pushNotification({
        kind: 'error',
        variant: 'error',
        title: 'Setup not saved',
        message: 'Your session is no longer active. Please sign in again and resubmit the setup.',
      })
      return
    }

    setSaving(true)
    const payload = {
      name: form.name.trim(),
      ticker: form.ticker.trim().toUpperCase(),
      direction: form.direction,
      strategy_id: form.strategy_id || undefined,
      reasons: form.reasons.trim() || undefined,
      entry_price: Number(form.entry_price),
      take_profit: Number(form.take_profit),
      stop_loss: Number(form.stop_loss),
      probability: form.probability,
      tags: form.tags,
    }

    try {
      if (editingId) {
        const updated = await updateSetup(editingId, {
          ...payload,
          status: selectedSetup?.status ?? 'open',
        })
        if (updated) {
          setMode('view')
          setEditingId(null)
        }
      } else {
        const created = await createSetup({
          user_id: currentUserId,
          ...payload,
          status: 'open',
        })
        if (created) {
          setSelectedId(created.id)
          setEditingId(null)
          setMode('view')
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const handleCloseSetup = async () => {
    if (!selectedSetup || selectedSetup.status === 'closed') return
    setClosingSetup(selectedSetup)
    setCloseStatus(selectedSetup.close_outcome ?? 'cancelled')
    setCloseNotes(selectedSetup.close_notes ?? '')
  }

  const handleSubmitClose = async () => {
    if (!closingSetup) return

    setClosing(true)
    const updated = await updateSetup(closingSetup.id, {
      status: 'closed',
      close_outcome: closeStatus,
      close_notes: closeNotes.trim() || undefined,
      closed_at: new Date().toISOString(),
    })

    setClosing(false)
    if (updated) {
      setClosingSetup(null)
      setCloseNotes('')
    }
  }

  const handleDelete = async () => {
    if (!editingId) return
    const setup = setups.find((s) => s.id === editingId)
    if (!setup) return
    if (!window.confirm(`Delete setup "${setup.name}"? This cannot be undone.`)) return

    const ok = await deleteSetup(editingId)
    if (ok) {
      setEditingId(null)
      setSelectedId(null)
      setMode('view')
      setForm(EMPTY_FORM)
    }
  }

  const handleScreenshotUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!user?.id || !selectedSetup?.id) return
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    for (const file of files) {
      await uploadScreenshot(user.id, selectedSetup.id, file)
    }

    e.target.value = ''
  }

  const currentScreenshots = selectedSetup?.screenshots ?? []
  const rr = selectedSetup
    ? calcRiskReward(selectedSetup.entry_price, selectedSetup.stop_loss, selectedSetup.take_profit)
    : null

  return (
    <div className="p-6 space-y-4 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display tracking-wider">SETUPS</h1>
            <span className="rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-300">
              BETA
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Create and review executable trade ideas before placing real trades.
          </p>
        </div>
        <button
          type="button"
          onClick={startNew}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          New Setup
        </button>
      </div>

      <div className="p-4 rounded-lg border border-border bg-card space-y-3">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search setup name, ticker, strategy..."
            className="w-full bg-input border border-border rounded-md pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {(['all', 'open', 'closed'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                statusFilter === value
                  ? 'bg-accent text-foreground border border-primary/50'
                  : 'bg-input border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {value === 'all' ? 'All Setups' : value.charAt(0).toUpperCase() + value.slice(1)}
            </button>
          ))}
          <p className="text-xs text-muted-foreground ml-auto">
            {filteredSetups.length} of {setups.length} setups
          </p>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-md border border-destructive/40 bg-destructive/10 text-sm text-destructive">
          {error}
        </div>
      )}

      {saveBlockedReason && (
        <div className="px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/10 text-sm text-amber-200">
          {saveBlockedReason}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-accent/30">
          <div className="w-7" />
          <div className="flex-1 text-xs text-muted-foreground">Ticker / Setup</div>
          <div className="hidden md:block w-56 text-right text-xs text-muted-foreground">Created / Levels</div>
          <div className="w-20 text-right text-xs text-muted-foreground">Probability</div>
        </div>

        {loading && setups.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : filteredSetups.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No setups match your filters.</div>
        ) : (
          filteredSetups.map((setup) => (
            <SetupRow
              key={setup.id}
              setup={setup}
              strategyName={setup.strategy_id ? strategyById.get(setup.strategy_id) : undefined}
              onClick={() => handleSelect(setup)}
            />
          ))
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="space-y-4">
          {mode === 'view' && selectedSetup && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-lg font-display tracking-wide">{selectedSetup.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {selectedSetup.ticker.toUpperCase()} · {selectedSetup.direction.toUpperCase()} · Created {fmt.date(selectedSetup.created_at)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Strategy: {selectedSetup.strategy_id ? strategyById.get(selectedSetup.strategy_id) ?? 'Unknown strategy' : 'None'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedSetup.status === 'open' && (
                      <button
                        type="button"
                        onClick={handleCloseSetup}
                        className="px-3 py-1.5 rounded-md border border-amber-500/40 text-[11px] font-medium text-amber-300 hover:bg-amber-500/10 transition-colors"
                      >
                        Close / Cancel Setup
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedSetup) return
                        setEditingId(selectedSetup.id)
                        setMode('edit')
                      }}
                      className="px-3 py-1.5 rounded-md border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/60 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded border border-border/60 bg-accent/20 p-2">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Entry</p>
                    <p className="mt-1 font-mono text-sm">${selectedSetup.entry_price.toFixed(2)}</p>
                  </div>
                  <div className="rounded border border-border/60 bg-accent/20 p-2">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Take Profit</p>
                    <p className="mt-1 font-mono text-sm text-[#00d4a1]">${selectedSetup.take_profit.toFixed(2)}</p>
                  </div>
                  <div className="rounded border border-border/60 bg-accent/20 p-2">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Stop Loss</p>
                    <p className="mt-1 font-mono text-sm text-[#ff4d6d]">${selectedSetup.stop_loss.toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    Probability:{' '}
                    <span className="font-semibold text-foreground">{formatProbabilityLabel(selectedSetup.probability)}</span>
                  </span>
                  {rr != null && (
                    <span>
                      R/R:{' '}
                      <span className="font-mono font-semibold text-foreground">{rr.toFixed(2)}</span>
                    </span>
                  )}
                  <span>
                    Status:{' '}
                    <span className="font-semibold text-foreground">
                      {selectedSetup.status === 'closed' ? (selectedSetup.close_outcome ?? 'closed') : 'open'}
                    </span>
                  </span>
                </div>

                {selectedSetup.status === 'closed' && selectedSetup.close_notes && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Close Notes</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{selectedSetup.close_notes}</p>
                  </div>
                )}

                {selectedSetup.reasons && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Reasons</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{selectedSetup.reasons}</p>
                  </div>
                )}

                {selectedSetup.tags && selectedSetup.tags.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSetup.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-sm text-[10px] font-mono bg-primary/15 text-primary/90 border border-primary/30"
                        >
                          {STRATEGY_TAG_LABELS[tag] ?? tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {(mode === 'edit' || mode === 'create') && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
                    Setup details
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Define risk levels and capture why this setup is worth taking.
                  </p>
                </div>
                {saving && (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Setup name</label>
                  <input
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="e.g. Breakout Through Daily High"
                    className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Ticker</label>
                  <input
                    value={form.ticker}
                    onChange={(e) => handleChange('ticker', e.target.value.toUpperCase())}
                    placeholder="e.g. NVDA"
                    className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Direction</label>
                  <select
                    value={form.direction}
                    onChange={(e) => handleChange('direction', e.target.value as TradeDirection)}
                    className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Strategy (from playbook)</label>
                  <select
                    value={form.strategy_id}
                    onChange={(e) => handleChange('strategy_id', e.target.value)}
                    className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">- None -</option>
                    {strategies.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Entry</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.entry_price}
                    onChange={(e) => handleChange('entry_price', Number(e.target.value) || 0)}
                    className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Take Profit</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.take_profit}
                    onChange={(e) => handleChange('take_profit', Number(e.target.value) || 0)}
                    className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Stop Loss</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.stop_loss}
                    onChange={(e) => handleChange('stop_loss', Number(e.target.value) || 0)}
                    className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Probability</label>
                <div className="flex items-center gap-2">
                  {(['low', 'medium', 'high'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleChange('probability', value)}
                      className={cn(
                        'px-3 py-1.5 rounded-md border text-xs font-medium',
                        form.probability === value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-input text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {formatProbabilityLabel(value)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Reasons for setup</label>
                <textarea
                  value={form.reasons}
                  onChange={(e) => handleChange('reasons', e.target.value)}
                  rows={4}
                  placeholder="List your setup criteria and the reasons this trade has an edge."
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Strategy tags</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(STRATEGY_TAG_LABELS).map(([key, label]) => {
                    const tag = key as StrategyTag
                    const isActive = form.tags.includes(tag)
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          'px-2.5 py-1 rounded text-xs font-medium transition-colors border',
                          isActive
                            ? 'bg-primary/20 border-primary/50 text-primary'
                            : 'bg-input border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60 mt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!form.name.trim() || !form.ticker.trim() || saving || !authReady}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/60 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlusCircle className="w-3 h-3" />}
                  {editingId ? 'Save changes' : 'Create setup'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-destructive/40 text-xs font-medium text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {selectedSetup && (
          <div>
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Screenshots</span>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Upload screenshot evidence for this setup, such as chart annotations and entry context.
              </p>

              <label className="flex items-center gap-2 w-fit cursor-pointer px-3 py-1.5 rounded-md border border-dashed border-border hover:border-primary/60 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                <ImageIcon className="w-3 h-3" />
                Add screenshots
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleScreenshotUpload}
                />
              </label>

              {currentScreenshots.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {currentScreenshots.map((s) => (
                    <div key={s.id} className="relative group">
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={s.url}
                          alt={s.label ?? 'setup screenshot'}
                          className="w-28 h-20 object-cover rounded-md border border-border hover:border-primary/50 transition-colors"
                        />
                      </a>
                      <button
                        type="button"
                        onClick={() => deleteScreenshot(s.id, s.storage_path)}
                        className="absolute top-1 right-1 bg-background/80 rounded-full px-1 py-0.5 text-[10px] text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground/80">
                  No screenshots yet. Upload one or more images after saving your setup.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {closingSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-display tracking-wide">Close Setup</h3>
                <p className="text-xs text-muted-foreground mt-1">Select the outcome and optionally add notes.</p>
              </div>
              <button
                type="button"
                onClick={() => setClosingSetup(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <label className="space-y-1 block">
                <span className="text-xs text-muted-foreground">Status</span>
                <select
                  value={closeStatus}
                  onChange={(e) => setCloseStatus(e.target.value as Setup['close_outcome'])}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
                >
                  <option value="successful">Successful</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>

              <label className="space-y-1 block">
                <span className="text-xs text-muted-foreground">Notes (optional)</span>
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  rows={4}
                  placeholder="Add any context or lessons learned..."
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm resize-none"
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClosingSetup(null)}
                  className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmitClose()}
                  disabled={closing}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {closing && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Closure
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
