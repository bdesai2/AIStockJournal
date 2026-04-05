import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PlusCircle, Trash2, ChevronDown, ChevronUp, Loader2, ArrowLeft, Upload, X, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useTradeStore } from '@/store/tradeStore'
import { useAiStore } from '@/store/aiStore'
import { STRATEGY_TAG_LABELS } from '@/lib/tradeUtils'
import { cn } from '@/lib/utils'
import type { CreateTradeInput, StrategyTag } from '@/types'

// ─── Zod schema ──────────────────────────────────────────────────────────────

const optionLegSchema = z.object({
  action: z.enum(['buy', 'sell']),
  option_type: z.enum(['call', 'put']),
  strike: z.coerce.number().positive(),
  expiration: z.string().min(1, 'Required'),
  contracts: z.coerce.number().positive().int(),
  premium: z.coerce.number().nonnegative(),
  delta: z.coerce.number().optional(),
  iv: z.coerce.number().optional(),
})

const nullableString = z.string().nullable().optional().transform((v) => v ?? undefined)
const nullablePositive = z.coerce.number().optional().transform((v) => (v === 0 || v == null ? undefined : v))

const tradeSchema = z.object({
  ticker: z.string().min(1, 'Ticker is required').max(10).transform((v) => v.toUpperCase()),
  asset_type: z.enum(['stock', 'option', 'etf', 'crypto']),
  direction: z.enum(['long', 'short']),
  status: z.enum(['open', 'closed', 'partial']),

  entry_date: z.string().min(1, 'Entry date required'),
  exit_date: nullableString,

  entry_price: z.coerce.number().positive('Entry price required'),
  exit_price: nullablePositive,
  quantity: z.coerce.number().positive('Quantity required'),
  fees: z.coerce.number().nonnegative().optional(),

  stop_loss: nullablePositive,
  take_profit: nullablePositive,
  initial_risk: z.coerce.number().nonnegative().optional().transform((v) => v === 0 ? undefined : v),
  risk_percent: z.coerce.number().nonnegative().optional().transform((v) => v === 0 ? undefined : v),

  // Options
  option_type: z.string().nullable().optional()
    .transform((v) => v === '' || !v ? undefined : v)
    .pipe(z.enum(['call', 'put']).optional()),
  option_legs: z.array(optionLegSchema).optional(),
  option_strategy: nullableString,

  // Crypto
  exchange: nullableString,

  // Journal
  setup_notes: nullableString,
  entry_notes: nullableString,
  exit_notes: nullableString,
  mistakes: nullableString,
  lessons: nullableString,
  emotional_state: z.string().optional()
    .transform((v) => v === '' || !v ? undefined : v)
    .pipe(z.enum(['calm', 'fomo', 'fearful', 'confident', 'impulsive', 'disciplined']).optional()),
  execution_quality: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),

  // Categorization
  strategy_tags: z.array(z.string()).default([]),
  custom_tags: z.array(z.string()).optional(),
  sector: nullableString,
  market_conditions: z.string().optional()
    .transform((v) => v === '' || !v ? undefined : v)
    .pipe(z.enum(['trending_up', 'trending_down', 'ranging', 'volatile']).optional()),
  timeframe: z.string().optional()
    .transform((v) => v === '' || !v ? undefined : v)
    .pipe(z.enum(['1m', '5m', '15m', '1h', '4h', 'D', 'W']).optional()),
  duration: z.string().nullable().optional()
    .transform((v) => v === '' || !v ? undefined : v)
    .pipe(z.enum(['scalp', 'swing', 'long_term']).optional()),
})

type TradeFormData = z.infer<typeof tradeSchema>

// ─── Common Sectors for Typeahead ────────────────────────────────────────────

const COMMON_SECTORS = [
  'Technology',
  'Healthcare',
  'Financials',
  'Energy',
  'Materials',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Industrials',
  'Utilities',
  'Real Estate',
  'Communication Services',
  'Semiconductors',
  'Software',
  'Financial Services',
  'Banks',
  'Oil & Gas',
  'Metals & Mining',
  'Aerospace & Defense',
  'Agriculture',
  'Transportation',
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = true }: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-border/60 hover:bg-accent/30 transition-colors"
      >
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  )
}

function Field({ label, error, children, required }: {
  label: string
  error?: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground/70">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}

const inputClass = 'w-full bg-input border border-border rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary font-mono'
const selectClass = `${inputClass} cursor-pointer`
const textareaClass = `${inputClass} resize-none font-sans`

// ─── Main Component ───────────────────────────────────────────────────────────

export function NewTradePage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { state } = useLocation()
  const prefill = (state as { prefill?: Partial<TradeFormData> } | null)?.prefill
  const isEdit = !!id
  const { user } = useAuthStore()
  const { createTrade, updateTrade, trades, uploadScreenshot, deleteScreenshot } = useTradeStore()
  const { runSetupCheck, setupLoading, setupResult, setupError, clearSetupResult } = useAiStore()

  const existingTrade = isEdit ? trades.find((t) => t.id === id) : undefined

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<TradeFormData>({
    resolver: zodResolver(tradeSchema),
    defaultValues: {
      asset_type: prefill?.asset_type ?? 'stock',
      direction: prefill?.direction ?? 'long',
      ticker: prefill?.ticker ?? '',
      exchange: prefill?.exchange ?? '',
      status: 'open',
      strategy_tags: [],
      entry_date: new Date().toISOString().slice(0, 16),
      fees: 0,
      duration: 'swing',
    },
  })

  const { fields: optionLegs, append: addLeg, remove: removeLeg } = useFieldArray({
    control,
    name: 'option_legs',
  })

  const assetType = watch('asset_type')
  const status = watch('status')
  const selectedTags = watch('strategy_tags')
  const ticker = watch('ticker')

  // Populate form when editing
  useEffect(() => {
    if (existingTrade) {
      reset({
        ...existingTrade,
        entry_date: existingTrade.entry_date
          ? new Date(existingTrade.entry_date).toISOString().slice(0, 16)
          : '',
        exit_date: existingTrade.exit_date
          ? new Date(existingTrade.exit_date).toISOString().slice(0, 16)
          : undefined,
        strategy_tags: existingTrade.strategy_tags ?? [],
      } as TradeFormData)
    }
  }, [existingTrade, reset])

  const [sectorLoading, setSectorLoading] = useState(false)

  // Auto-populate sector from Yahoo Finance on ticker change
  useEffect(() => {
    if (!ticker || ticker.length < 1 || assetType === 'crypto' || isEdit) return
    if (getValues('sector')) return // don't overwrite manual input

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSectorLoading(true)
      try {
        const res = await fetch(
          `/api/yahoo/sector/${encodeURIComponent(ticker.toUpperCase())}`,
          { signal: controller.signal }
        )
        if (!res.ok) return
        const json: { sector?: string | null } = await res.json()
        if (json.sector) {
          setValue('sector', json.sector, { shouldDirty: false })
        }
      } catch {
        // Network error — user can fill in manually
      } finally {
        setSectorLoading(false)
      }
    }, 800)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [ticker, assetType, isEdit, getValues, setValue])

  const toggleTag = (tag: string) => {
    const current = selectedTags ?? []
    if (current.includes(tag)) {
      setValue('strategy_tags', current.filter((t) => t !== tag))
    } else {
      setValue('strategy_tags', [...current, tag])
    }
  }

  // Cleanup setup check result on unmount
  useEffect(() => {
    return () => clearSetupResult()
  }, [])

  const handleSetupCheck = () => {
    const values = getValues()
    if (!values.ticker || !values.entry_price) return
    runSetupCheck({
      ticker: values.ticker,
      entry_price: Number(values.entry_price),
      stop_loss: values.stop_loss ? Number(values.stop_loss) : undefined,
      take_profit: values.take_profit ? Number(values.take_profit) : undefined,
      direction: values.direction,
      quantity: values.quantity ? Number(values.quantity) : undefined,
    })
  }

  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setPendingFiles((prev) => [...prev, ...files])
    e.target.value = ''
  }

  const onSubmit = async (data: TradeFormData) => {
    if (!user?.id) return
    console.log('✅ onSubmit fired', data)
    const basePayload: Partial<CreateTradeInput> = {
      ...data,
      // Ensure dates are stored as ISO strings
      entry_date: new Date(data.entry_date.replace('T', ' ')).toISOString(),
      exit_date: data.exit_date ? new Date(data.exit_date.replace('T', ' ')).toISOString() : undefined,
      // Give each option leg a stable id for screenshots/UI
      option_legs: data.option_legs?.map((leg) => ({ ...leg, id: crypto.randomUUID() })),
      // Narrow execution_quality to the trade type
      execution_quality: data.execution_quality as 1 | 2 | 3 | 4 | 5 | undefined,
      // Align form tags (strings) with the StrategyTag literal union
      strategy_tags: (data.strategy_tags ?? []) as StrategyTag[],
      // Only include option_type for option trades
      option_type: data.asset_type === 'option' ? data.option_type : undefined,
    }

    if (isEdit && id) {
      const updated = await updateTrade(id, basePayload)
      if (updated) {
        for (const file of pendingFiles) {
          await uploadScreenshot(user.id, id, file)
        }
        navigate(`/trades/${id}`)
      }
    } else {
      const createPayload = {
        ...(basePayload as CreateTradeInput),
        user_id: user.id,
      } as CreateTradeInput & { user_id: string }
      const created = await createTrade(createPayload)
      if (created) {
        for (const file of pendingFiles) {
          await uploadScreenshot(user.id, created.id, file)
        }
        navigate(`/trades/${created.id}`)
      }
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 animate-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-display tracking-wider">
            {isEdit ? 'EDIT TRADE' : 'LOG TRADE'}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isEdit ? `Editing ${existingTrade?.ticker}` : 'Record a new trade entry'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit, (errors) => console.error('❌ Validation errors', errors))} className="space-y-5">
        {/* ── Core fields ── */}
        <Section title="Trade Details">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Ticker" error={errors.ticker?.message} required>
              <input
                {...register('ticker')}
                placeholder="AAPL"
                className={cn(inputClass, 'uppercase')}
              />
            </Field>

            <Field label="Asset Type" required>
              <select {...register('asset_type')} className={selectClass}>
                <option value="stock">Stock</option>
                <option value="option">Option</option>
                <option value="etf">ETF</option>
                <option value="crypto">Crypto</option>
              </select>
            </Field>

            <Field label="Direction" required>
              <select {...register('direction')} className={selectClass}>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </Field>

            <Field label="Status" required>
              <select {...register('status')} className={selectClass}>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="partial">Partial</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <Field label="Entry Date" error={errors.entry_date?.message} required>
              <input {...register('entry_date')} type="datetime-local" className={inputClass} />
            </Field>

            {(status === 'closed' || status === 'partial') && (
              <Field label="Exit Date">
                <input {...register('exit_date')} type="datetime-local" className={inputClass} />
              </Field>
            )}

            <Field label="Entry Price" error={errors.entry_price?.message} required>
              <input {...register('entry_price')} type="number" step="0.0001" placeholder="0.00" className={inputClass} />
            </Field>

            {(status === 'closed' || status === 'partial') && (
              <Field label="Exit Price">
                <input {...register('exit_price')} type="number" step="0.0001" placeholder="0.00" className={inputClass} />
              </Field>
            )}

            <Field label={assetType === 'option' ? 'Contracts' : 'Shares / Units'} error={errors.quantity?.message} required>
              <input {...register('quantity')} type="number" step="1" placeholder="100" className={inputClass} />
            </Field>

            <Field label="Fees ($)">
              <input {...register('fees')} type="number" step="0.01" placeholder="0.00" className={inputClass} />
            </Field>

            {assetType === 'crypto' && (
              <Field label="Exchange">
                <input {...register('exchange')} placeholder="Coinbase" className={inputClass} />
              </Field>
            )}
          </div>
        </Section>

        {/* ── Risk Management ── */}
        <Section title="Risk Management" defaultOpen={false}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Stop Loss">
              <input {...register('stop_loss')} type="number" step="0.0001" placeholder="0.00" className={inputClass} />
            </Field>
            <Field label="Take Profit">
              <input {...register('take_profit')} type="number" step="0.0001" placeholder="0.00" className={inputClass} />
            </Field>
            <Field label="Initial Risk ($)">
              <input {...register('initial_risk')} type="number" step="0.01" placeholder="0.00" className={inputClass} />
            </Field>
            <Field label="Risk % of Account">
              <input {...register('risk_percent')} type="number" step="0.01" placeholder="1.5" className={inputClass} />
            </Field>
          </div>

          {/* Setup Check */}
          <div className="mt-4 pt-4 border-t border-border/40">
            <button
              type="button"
              onClick={handleSetupCheck}
              disabled={setupLoading || !watch('entry_price')}
              className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
            >
              {setupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Analyze Setup
            </button>

            {setupError && (
              <p className="text-destructive text-xs mt-2">{setupError}</p>
            )}

            {setupResult && (
              <div className="mt-3 rounded-md border border-border bg-accent/20 p-3 space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className={cn('px-2 py-0.5 rounded text-xs font-mono font-bold',
                    setupResult.rr_rating === 'excellent' || setupResult.rr_rating === 'good'
                      ? 'bg-profit-muted text-[#00d4a1]'
                      : setupResult.rr_rating === 'acceptable'
                      ? 'bg-blue-400/10 text-blue-400'
                      : 'bg-loss-muted text-[#ff4d6d]'
                  )}>
                    R/R: {setupResult.rr_rating}
                  </span>
                  <span className={cn('px-2 py-0.5 rounded text-xs font-mono font-bold',
                    setupResult.setup_quality === 'strong' ? 'bg-profit-muted text-[#00d4a1]' :
                    setupResult.setup_quality === 'moderate' ? 'bg-blue-400/10 text-blue-400' :
                    'bg-[#f0b429]/10 text-[#f0b429]'
                  )}>
                    Setup: {setupResult.setup_quality}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{setupResult.rr_comment}</p>
                <p className="text-xs text-muted-foreground">{setupResult.setup_comment}</p>
                <p className="text-xs text-foreground/70">{setupResult.position_size_note}</p>
                {setupResult.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-[#f0b429] flex items-start gap-1">
                    <span>⚠</span>{w}
                  </p>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* ── Option Legs ── */}
        {assetType === 'option' && (
          <Section title="Option Legs">
            <div className="mb-3 flex gap-4 items-end">
              <div className="flex-1">
                <Field label="Strategy Name">
                  <input
                    {...register('option_strategy')}
                    placeholder="e.g. Bull Call Spread"
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setValue('option_type', 'call')}
                  className={cn(
                    'px-4 py-2 rounded-md text-sm font-medium transition-colors border',
                    watch('option_type') === 'call'
                      ? 'bg-profit-muted text-[#00d4a1] border-[#00d4a1]/50'
                      : 'bg-input border-border text-muted-foreground hover:border-border/80'
                  )}
                >
                  CALL
                </button>
                <button
                  type="button"
                  onClick={() => setValue('option_type', 'put')}
                  className={cn(
                    'px-4 py-2 rounded-md text-sm font-medium transition-colors border',
                    watch('option_type') === 'put'
                      ? 'bg-loss-muted text-[#ff4d6d] border-[#ff4d6d]/50'
                      : 'bg-input border-border text-muted-foreground hover:border-border/80'
                  )}
                >
                  PUT
                </button>
              </div>
            </div>

            {optionLegs.map((leg, i) => (
              <div key={leg.id} className="rounded-md border border-border/60 bg-accent/20 p-3 mb-3 relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono text-muted-foreground">Leg {i + 1}</span>
                  <button type="button" onClick={() => removeLeg(i)} className="text-destructive/60 hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Field label="Action">
                    <select {...register(`option_legs.${i}.action`)} className={selectClass}>
                      <option value="buy">Buy</option>
                      <option value="sell">Sell</option>
                    </select>
                  </Field>
                  <Field label="Type">
                    <select {...register(`option_legs.${i}.option_type`)} className={selectClass}>
                      <option value="call">Call</option>
                      <option value="put">Put</option>
                    </select>
                  </Field>
                  <Field label="Strike" error={errors.option_legs?.[i]?.strike?.message}>
                    <input {...register(`option_legs.${i}.strike`)} type="number" step="0.5" placeholder="150.00" className={inputClass} />
                  </Field>
                  <Field label="Expiration" error={errors.option_legs?.[i]?.expiration?.message}>
                    <input {...register(`option_legs.${i}.expiration`)} type="date" className={inputClass} />
                  </Field>
                  <Field label="Contracts">
                    <input {...register(`option_legs.${i}.contracts`)} type="number" placeholder="1" className={inputClass} />
                  </Field>
                  <Field label="Premium">
                    <input {...register(`option_legs.${i}.premium`)} type="number" step="0.01" placeholder="1.50" className={inputClass} />
                  </Field>
                  <Field label="Delta">
                    <input {...register(`option_legs.${i}.delta`)} type="number" step="0.01" placeholder="0.45" className={inputClass} />
                  </Field>
                  <Field label="IV %">
                    <input {...register(`option_legs.${i}.iv`)} type="number" step="0.1" placeholder="35.0" className={inputClass} />
                  </Field>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => addLeg({ action: 'buy', option_type: 'call', strike: 0, expiration: '', contracts: 1, premium: 0 })}
              className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Add Leg
            </button>
          </Section>
        )}

        {/* ── Categorization ── */}
        <Section title="Categorization" defaultOpen={false}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <Field label="Timeframe">
              <select {...register('timeframe')} className={selectClass}>
                <option value="">— Select —</option>
                {(['1m', '5m', '15m', '1h', '4h', 'D', 'W'] as const).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Duration">
              <select {...register('duration')} className={selectClass}>
                <option value="">— Select —</option>
                <option value="scalp">Scalp</option>
                <option value="swing">Swing</option>
                <option value="long_term">Long term</option>
              </select>
            </Field>
            <Field label="Market Conditions">
              <select {...register('market_conditions')} className={selectClass}>
                <option value="">— Select —</option>
                <option value="trending_up">Trending Up</option>
                <option value="trending_down">Trending Down</option>
                <option value="ranging">Ranging</option>
                <option value="volatile">Volatile</option>
              </select>
            </Field>
            <Field label="Sector">
              <div className="relative">
                <input
                  {...register('sector')}
                  placeholder="e.g. Technology"
                  className={inputClass}
                  list="sector-list"
                />
                <datalist id="sector-list">
                  {COMMON_SECTORS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                {sectorLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
            </Field>
          </div>

          <Field label="Strategy Tags">
            <div className="flex flex-wrap gap-2 mt-1">
              {Object.entries(STRATEGY_TAG_LABELS).map(([key, label]) => {
                const isActive = selectedTags?.includes(key)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleTag(key)}
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
          </Field>
        </Section>

        {/* ── Journal ── */}
        <Section title="Journal Notes" defaultOpen={false}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Setup Notes (Why did you take this trade?)">
                <textarea {...register('setup_notes')} rows={3} placeholder="Describe the setup, catalyst, thesis..." className={textareaClass} />
              </Field>
              <Field label="Entry Notes">
                <textarea {...register('entry_notes')} rows={3} placeholder="How was the entry executed?" className={textareaClass} />
              </Field>
              <Field label="Exit Notes">
                <textarea {...register('exit_notes')} rows={3} placeholder="Why did you exit?" className={textareaClass} />
              </Field>
              <Field label="Mistakes">
                <textarea {...register('mistakes')} rows={3} placeholder="What would you do differently?" className={textareaClass} />
              </Field>
              <Field label="Lessons Learned">
                <textarea {...register('lessons')} rows={3} placeholder="Key takeaways from this trade" className={textareaClass} />
              </Field>
              <div className="space-y-4">
                <Field label="Emotional State">
                  <select {...register('emotional_state')} className={selectClass}>
                    <option value="">— Select —</option>
                    {(['calm', 'fomo', 'fearful', 'confident', 'impulsive', 'disciplined'] as const).map((v) => (
                      <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Execution Quality (1–5)">
                  <Controller
                    name="execution_quality"
                    control={control}
                    render={({ field }) => (
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => field.onChange(n)}
                            className={cn(
                              'w-9 h-9 rounded border text-sm font-mono font-medium transition-colors',
                              field.value === n
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-input border-border text-muted-foreground hover:border-primary/50'
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    )}
                  />
                </Field>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Screenshots ── */}
        <Section title="Screenshots / Charts" defaultOpen={false}>
          <div className="space-y-3">
            <label className="flex items-center gap-2 w-fit cursor-pointer px-4 py-2 rounded-md border border-dashed border-border hover:border-primary/50 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Upload className="w-4 h-4" />
              Add Screenshots
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileAdd} />
            </label>

            {/* Pending (new uploads) */}
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {pendingFiles.map((file, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-24 h-24 object-cover rounded-md border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 hover:bg-background transition-colors"
                    >
                      <X className="w-3 h-3 text-destructive" />
                    </button>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate w-24">{file.name}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Existing screenshots (edit mode) */}
            {existingTrade?.screenshots && existingTrade.screenshots.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {existingTrade.screenshots.map((s) => (
                  <div key={s.id} className="relative group">
                    <img src={s.url} alt={s.label ?? 'screenshot'} className="w-24 h-24 object-cover rounded-md border border-border" />
                    <button
                      type="button"
                      onClick={() => deleteScreenshot(s.id, s.storage_path)}
                      className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 hover:bg-background transition-colors"
                    >
                      <X className="w-3 h-3 text-destructive" />
                    </button>
                    {s.label && <p className="text-[10px] text-muted-foreground mt-1 truncate w-24">{s.label}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* ── Submit ── */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-6 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Log Trade'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
