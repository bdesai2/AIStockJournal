import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  BookOpen,
  ArrowRight,
  CheckSquare,
  Square,
} from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns'
import { useAuthStore } from '@/store/authStore'
import { useTradeStore } from '@/store/tradeStore'
import { useJournalStore } from '@/store/journalStore'
import { fmt, pnlColor } from '@/lib/tradeUtils'
import type { DailyJournal, Trade } from '@/types'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MOOD_EMOJIS: Record<number, string> = { 1: '😫', 2: '😕', 3: '😐', 4: '😊', 5: '😄' }

type DayData = { pnl: number; count: number; trades_list: Trade[] }

type GridCell =
  | { type: 'empty'; key: string }
  | { type: 'day'; date: Date; dateStr: string }

function cellClasses(pnl: number | null, isSelected: boolean): string {
  if (isSelected) return 'bg-primary/10 border-primary'
  if (pnl == null)
    return 'bg-card/50 border-transparent hover:bg-card hover:border-border/60'
  if (pnl > 0)
    return 'bg-[#00d4a1]/5 border-[#00d4a1]/25 hover:bg-[#00d4a1]/10 hover:border-[#00d4a1]/50'
  if (pnl < 0)
    return 'bg-[#ff4d6d]/5 border-[#ff4d6d]/25 hover:bg-[#ff4d6d]/10 hover:border-[#ff4d6d]/50'
  return 'bg-card/50 border-border/40 hover:border-border'
}

export function JournalPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { trades, fetchTrades } = useTradeStore()
  const { journals, fetchJournalsForMonth, upsertJournal } = useJournalStore()

  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    pre_market_notes: '',
    post_market_notes: '',
    market_mood: null as DailyJournal['market_mood'] | null,
    personal_mood: null as number | null,
    goals_text: '',
    reviewed_rules: false,
  })

  useEffect(() => {
    if (user?.id) fetchTrades(user.id)
  }, [user?.id, fetchTrades])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  useEffect(() => {
    if (user?.id) fetchJournalsForMonth(user.id, year, month)
  }, [user?.id, year, month, fetchJournalsForMonth])

  // Populate form when selected date changes
  useEffect(() => {
    if (!selectedDate) return
    const j = journals[selectedDate]
    setForm({
      pre_market_notes: j?.pre_market_notes ?? '',
      post_market_notes: j?.post_market_notes ?? '',
      market_mood: j?.market_mood ?? null,
      personal_mood: j?.personal_mood ?? null,
      goals_text: (j?.goals ?? []).join('\n'),
      reviewed_rules: j?.reviewed_rules ?? false,
    })
  }, [selectedDate, journals])

  // Build per-day P&L map from closed trades
  const dailyData = useMemo(() => {
    const map = new Map<string, DayData>()
    trades
      .filter((t) => t.status === 'closed' && t.exit_date)
      .forEach((t) => {
        const day = t.exit_date!.slice(0, 10)
        const existing = map.get(day) ?? { pnl: 0, count: 0, trades_list: [] }
        map.set(day, {
          pnl: existing.pnl + (t.net_pnl ?? 0),
          count: existing.count + 1,
          trades_list: [...existing.trades_list, t],
        })
      })
    return map
  }, [trades])

  // Calendar grid for current month
  const gridCells = useMemo((): GridCell[] => {
    const start = startOfMonth(currentDate)
    const days = eachDayOfInterval({ start, end: endOfMonth(currentDate) })
    const startOffset = getDay(start)

    const cells: GridCell[] = []
    for (let i = 0; i < startOffset; i++) cells.push({ type: 'empty', key: `e${i}` })
    for (const d of days) cells.push({ type: 'day', date: d, dateStr: format(d, 'yyyy-MM-dd') })
    const rem = cells.length % 7
    if (rem !== 0) {
      for (let i = 0; i < 7 - rem; i++) cells.push({ type: 'empty', key: `t${i}` })
    }
    return cells
  }, [currentDate])

  const selectedDayData = selectedDate ? dailyData.get(selectedDate) : undefined
  const selectedJournal = selectedDate ? journals[selectedDate] : undefined

  const handleSave = async () => {
    if (!user?.id || !selectedDate) return
    setSaving(true)
    await upsertJournal(user.id, selectedDate, {
      pre_market_notes: form.pre_market_notes || undefined,
      post_market_notes: form.post_market_notes || undefined,
      market_mood: form.market_mood ?? undefined,
      personal_mood: form.personal_mood
        ? (form.personal_mood as DailyJournal['personal_mood'])
        : undefined,
      goals: form.goals_text
        ? form.goals_text.split('\n').filter((g) => g.trim())
        : [],
      reviewed_rules: form.reviewed_rules,
    })
    setSaving(false)
  }

  const prevMonth = () => {
    setSelectedDate(null)
    setCurrentDate((d) => subMonths(d, 1))
  }

  const nextMonth = () => {
    setSelectedDate(null)
    setCurrentDate((d) => addMonths(d, 1))
  }

  return (
    <div className="p-6 space-y-6 animate-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display tracking-wider">DAILY JOURNAL</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Click any day to review trades and write journal notes
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-4">
        {/* ── Calendar ── */}
        <div className="flex-1 min-w-0 rounded-lg border border-border bg-card p-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-sm tracking-wide">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="text-center text-xs text-muted-foreground font-medium py-1"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {gridCells.map((cell) => {
              if (cell.type === 'empty') return <div key={cell.key} />

              const { date, dateStr } = cell
              const dayData = dailyData.get(dateStr)
              const hasJournal = !!journals[dateStr]
              const isSelected = selectedDate === dateStr
              const isCurrentDay = isToday(date)

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={[
                    'relative rounded-md border p-1.5 text-left transition-all min-h-[70px]',
                    cellClasses(dayData?.pnl ?? null, isSelected),
                  ].join(' ')}
                >
                  <span
                    className={[
                      'text-xs font-medium leading-none',
                      isCurrentDay
                        ? 'text-primary font-bold'
                        : 'text-foreground/60',
                    ].join(' ')}
                  >
                    {format(date, 'd')}
                  </span>

                  {dayData && (
                    <div className="mt-1.5 space-y-0.5">
                      <p
                        className={[
                          'text-[11px] font-mono font-semibold leading-none',
                          dayData.pnl >= 0 ? 'text-[#00d4a1]' : 'text-[#ff4d6d]',
                        ].join(' ')}
                      >
                        {dayData.pnl >= 0 ? '+' : ''}
                        {fmt.currency(dayData.pnl, 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-none">
                        {dayData.count}t
                      </p>
                    </div>
                  )}

                  {hasJournal && (
                    <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary/70" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-sm bg-[#00d4a1]/20 border border-[#00d4a1]/40" />
              Profit day
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-sm bg-[#ff4d6d]/20 border border-[#ff4d6d]/40" />
              Loss day
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/70" />
              Has journal
            </div>
          </div>
        </div>

        {/* ── Day Detail Panel ── */}
        {selectedDate ? (
          <div className="w-full xl:w-[380px] flex-shrink-0 rounded-lg border border-border bg-card flex flex-col max-h-[700px]">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <div>
                <p className="font-medium text-sm">
                  {format(new Date(selectedDate + 'T12:00:00'), 'EEEE, MMMM d')}
                </p>
                {selectedDayData ? (
                  <p
                    className={`text-xs font-mono mt-0.5 ${
                      selectedDayData.pnl >= 0 ? 'text-[#00d4a1]' : 'text-[#ff4d6d]'
                    }`}
                  >
                    {selectedDayData.pnl >= 0 ? '+' : ''}
                    {fmt.currency(selectedDayData.pnl)} ·{' '}
                    {selectedDayData.count} trade{selectedDayData.count !== 1 ? 's' : ''}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">No trades</p>
                )}
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Trades for this day */}
              {selectedDayData && selectedDayData.trades_list.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    Trades
                  </p>
                  <div className="space-y-1">
                    {selectedDayData.trades_list.map((trade) => (
                      <button
                        key={trade.id}
                        onClick={() => navigate(`/trades/${trade.id}`)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-muted/40 hover:bg-muted transition-colors text-left group"
                      >
                        <div className="flex items-center gap-2">
                          {trade.direction === 'long' ? (
                            <TrendingUp className="w-3.5 h-3.5 text-[#00d4a1] flex-shrink-0" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5 text-[#ff4d6d] flex-shrink-0" />
                          )}
                          <span className="text-sm font-mono font-medium">{trade.ticker}</span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {trade.asset_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-mono ${pnlColor(trade.net_pnl)}`}>
                            {fmt.currency(trade.net_pnl)}
                          </span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Journal form */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                  Journal Entry
                </p>

                {/* Market mood */}
                <div className="mb-3">
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Market Mood
                  </label>
                  <div className="flex gap-2">
                    {(['bullish', 'neutral', 'bearish'] as const).map((mood) => {
                      const active = form.market_mood === mood
                      const activeClasses =
                        mood === 'bullish'
                          ? 'bg-[#00d4a1]/20 border-[#00d4a1]/50 text-[#00d4a1]'
                          : mood === 'bearish'
                          ? 'bg-[#ff4d6d]/20 border-[#ff4d6d]/50 text-[#ff4d6d]'
                          : 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                      return (
                        <button
                          key={mood}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              market_mood: f.market_mood === mood ? null : mood,
                            }))
                          }
                          className={[
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors capitalize',
                            active
                              ? activeClasses
                              : 'bg-transparent border-border text-muted-foreground hover:border-foreground/30',
                          ].join(' ')}
                        >
                          {mood === 'bullish' ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : mood === 'bearish' ? (
                            <TrendingDown className="w-3 h-3" />
                          ) : (
                            <Minus className="w-3 h-3" />
                          )}
                          {mood}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Personal mood */}
                <div className="mb-3">
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Personal Mood
                  </label>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            personal_mood: f.personal_mood === n ? null : n,
                          }))
                        }
                        title={`Mood: ${n}/5`}
                        className={[
                          'w-9 h-9 rounded-md text-base border transition-colors',
                          form.personal_mood === n
                            ? 'bg-primary/20 border-primary/50'
                            : 'bg-transparent border-border hover:border-foreground/30',
                        ].join(' ')}
                      >
                        {MOOD_EMOJIS[n]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pre-market notes */}
                <div className="mb-3">
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Pre-Market Notes
                  </label>
                  <textarea
                    value={form.pre_market_notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, pre_market_notes: e.target.value }))
                    }
                    placeholder="Outlook, planned trades, goals for today..."
                    rows={3}
                    className="w-full rounded-md bg-background border border-border px-3 py-2 text-xs placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </div>

                {/* Post-market notes */}
                <div className="mb-3">
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Post-Market Notes
                  </label>
                  <textarea
                    value={form.post_market_notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, post_market_notes: e.target.value }))
                    }
                    placeholder="What happened? Key lessons learned..."
                    rows={3}
                    className="w-full rounded-md bg-background border border-border px-3 py-2 text-xs placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </div>

                {/* Goals */}
                <div className="mb-3">
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Goals{' '}
                    <span className="text-muted-foreground/50">(one per line)</span>
                  </label>
                  <textarea
                    value={form.goals_text}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, goals_text: e.target.value }))
                    }
                    placeholder={`Follow my trading plan\nNo revenge trading\nMax 3 trades today`}
                    rows={3}
                    className="w-full rounded-md bg-background border border-border px-3 py-2 text-xs placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </div>

                {/* Reviewed rules toggle */}
                <div className="mb-4">
                  <button
                    onClick={() =>
                      setForm((f) => ({ ...f, reviewed_rules: !f.reviewed_rules }))
                    }
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {form.reviewed_rules ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    Reviewed trading rules today
                  </button>
                </div>

                {/* Save */}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : selectedJournal ? 'Update Entry' : 'Save Entry'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Empty state placeholder */
          <div className="hidden xl:flex xl:w-[380px] flex-shrink-0 rounded-lg border border-dashed border-border bg-card/30 items-center justify-center">
            <div className="text-center p-8">
              <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Select a day to view trades and write your journal notes
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
