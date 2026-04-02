import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PlusCircle, Trash2, ChevronDown, ChevronUp, Loader2, ArrowLeft, Upload, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useTradeStore } from '@/store/tradeStore'
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

const tradeSchema = z.object({
  ticker: z.string().min(1, 'Ticker is required').max(10).transform((v) => v.toUpperCase()),
  asset_type: z.enum(['stock', 'option', 'etf', 'crypto']),
  direction: z.enum(['long', 'short']),
  status: z.enum(['open', 'closed', 'partial']),

  entry_date: z.string().min(1, 'Entry date required'),
  exit_date: z.string().optional(),

  entry_price: z.coerce.number().positive('Entry price required'),
  exit_price: z.coerce.number().positive().optional(),
  quantity: z.coerce.number().positive('Quantity required'),
  fees: z.coerce.number().nonnegative().optional(),

  stop_loss: z.coerce.number().positive().optional(),
  take_profit: z.coerce.number().positive().optional(),
  initial_risk: z.coerce.number().nonnegative().optional(),
  risk_percent: z.coerce.number().nonnegative().optional(),

  // Options
  option_legs: z.array(optionLegSchema).optional(),
  option_strategy: z.string().optional(),

  // Crypto
  exchange: z.string().optional(),

  // Journal
  setup_notes: z.string().optional(),
  entry_notes: z.string().optional(),
  exit_notes: z.string().optional(),
  mistakes: z.string().optional(),
  lessons: z.string().optional(),
  emotional_state: z.enum(['calm', 'fomo', 'fearful', 'confident', 'impulsive', 'disciplined']).optional(),
  execution_quality: z.coerce.number().min(1).max(5).optional(),

  // Categorization
  strategy_tags: z.array(z.string()).default([]),
  custom_tags: z.array(z.string()).optional(),
  sector: z.string().optional(),
  market_conditions: z.enum(['trending_up', 'trending_down', 'ranging', 'volatile']).optional(),
  timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', 'D', 'W']).optional(),
})

type TradeFormData = z.infer<typeof tradeSchema>

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
  const isEdit = !!id
  const { user } = useAuthStore()
  const { createTrade, updateTrade, trades, uploadScreenshot, deleteScreenshot } = useTradeStore()

  const existingTrade = isEdit ? trades.find((t) => t.id === id) : undefined

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TradeFormData>({
    resolver: zodResolver(tradeSchema),
    defaultValues: {
      asset_type: 'stock',
      direction: 'long',
      status: 'open',
      strategy_tags: [],
      entry_date: new Date().toISOString().slice(0, 16),
      fees: 0,
    },
  })

  const { fields: optionLegs, append: addLeg, remove: removeLeg } = useFieldArray({
    control,
    name: 'option_legs',
  })

  const assetType = watch('asset_type')
  const status = watch('status')
  const selectedTags = watch('strategy_tags')

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

  const toggleTag = (tag: string) => {
    const current = selectedTags ?? []
    if (current.includes(tag)) {
      setValue('strategy_tags', current.filter((t) => t !== tag))
    } else {
      setValue('strategy_tags', [...current, tag])
    }
  }

  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setPendingFiles((prev) => [...prev, ...files])
    e.target.value = ''
  }

  const onSubmit = async (data: TradeFormData) => {
    if (!user?.id) return

    const basePayload: Partial<CreateTradeInput> = {
      ...data,
      // Ensure dates are stored as ISO strings
      entry_date: new Date(data.entry_date).toISOString(),
      exit_date: data.exit_date ? new Date(data.exit_date).toISOString() : undefined,
      // Give each option leg a stable id for screenshots/UI
      option_legs: data.option_legs?.map((leg) => ({ ...leg, id: crypto.randomUUID() })),
      // Narrow execution_quality to the trade type
      execution_quality: data.execution_quality as 1 | 2 | 3 | 4 | 5 | undefined,
      // Align form tags (strings) with the StrategyTag literal union
      strategy_tags: (data.strategy_tags ?? []) as StrategyTag[],
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

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
        </Section>

        {/* ── Option Legs ── */}
        {assetType === 'option' && (
          <Section title="Option Legs">
            <div className="mb-3">
              <Field label="Strategy Name">
                <input
                  {...register('option_strategy')}
                  placeholder="e.g. Bull Call Spread"
                  className={inputClass}
                />
              </Field>
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
              <input {...register('sector')} placeholder="e.g. Technology" className={inputClass} />
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
                      className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
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
                      className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
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
