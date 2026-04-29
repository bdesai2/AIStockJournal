import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PlusCircle, Search, Filter, ArrowUpDown, Download } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useTradeStore } from '@/store/tradeStore'
import { TradeRow } from '@/components/trades/TradeRow'
import type { AssetType, TradeStatus, Trade } from '@/types'
import { calcPnlPercent } from '@/lib/tradeUtils'

type SortKey = 'entry_date' | 'net_pnl' | 'pnl_percent' | 'r_multiple' | 'ticker'
type SortDir = 'asc' | 'desc'
type GradeFilter = 'all' | 'A' | 'B' | 'C' | 'D' | 'F' | '-'

const FILTER_STORAGE_KEY = 'trades_filters_v1'

function exportToCsv(trades: Trade[]) {
  const headers = [
    'Date', 'Ticker', 'Direction', 'Asset', 'Status',
    'Entry Price', 'Exit Price', 'Qty', 'Gross P&L', 'Net P&L',
    'P&L %', 'R Multiple', 'Grade', 'Strategy Tags',
  ]
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = trades.map((t) => [
    t.entry_date,
    t.ticker,
    t.direction,
    t.asset_type,
    t.status,
    t.entry_price,
    t.exit_price ?? '',
    t.quantity,
    t.gross_pnl ?? '',
    t.net_pnl ?? '',
    t.exit_price != null ? (calcPnlPercent(t) ?? 0).toFixed(2) : '',
    t.r_multiple ?? '',
    t.ai_grade ?? '',
    (t.strategy_tags ?? []).join('; '),
  ])
  const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `trades-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function getInitialFilters(): {
  search: string
  assetFilter: AssetType | 'all'
  statusFilter: TradeStatus | 'all'
  dirFilter: 'long' | 'short' | 'all'
  gradeFilter: GradeFilter
  sortKey: SortKey
  sortDir: SortDir
} {
  const defaults: {
    search: string
    assetFilter: AssetType | 'all'
    statusFilter: TradeStatus | 'all'
    dirFilter: 'long' | 'short' | 'all'
    gradeFilter: GradeFilter
    sortKey: SortKey
    sortDir: SortDir
  } = {
    search: '',
    assetFilter: 'all',
    statusFilter: 'all',
    dirFilter: 'all',
    gradeFilter: 'all',
    sortKey: 'entry_date',
    sortDir: 'desc',
  }

  if (typeof window === 'undefined') return defaults

  try {
    const raw = window.localStorage.getItem(FILTER_STORAGE_KEY)
    if (!raw) return defaults
    const saved = JSON.parse(raw) as Partial<typeof defaults>
    return { ...defaults, ...saved }
  } catch {
    return defaults
  }
}

export function TradesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, selectedAccountId } = useAuthStore()
  const { trades, loading, fetchTrades } = useTradeStore()
  const drilldown = searchParams.get('drilldown')?.trim().toLowerCase() ?? ''
  const exitDateFilter = searchParams.get('exitDate')?.trim() ?? ''
  const exitDateFromFilter = searchParams.get('exitDateFrom')?.trim() ?? ''
  const exitDateToFilter = searchParams.get('exitDateTo')?.trim() ?? ''
  const hasChartDrilldown = !!exitDateFilter || (!!exitDateFromFilter && !!exitDateToFilter)
  const drilldownLabel =
    drilldown === 'daily'
      ? 'Daily P&L'
      : drilldown === 'weekly'
        ? 'Weekly P&L'
        : drilldown === 'monthly'
          ? 'Monthly P&L'
          : 'Chart'

  const [search, setSearch] = useState(() => getInitialFilters().search)
  const [assetFilter, setAssetFilter] = useState<AssetType | 'all'>(() => getInitialFilters().assetFilter)
  const [statusFilter, setStatusFilter] = useState<TradeStatus | 'all'>(() => getInitialFilters().statusFilter)
  const [dirFilter, setDirFilter] = useState<'long' | 'short' | 'all'>(() => getInitialFilters().dirFilter)
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>(() => getInitialFilters().gradeFilter)
  const [sortKey, setSortKey] = useState<SortKey>(() => getInitialFilters().sortKey)
  const [sortDir, setSortDir] = useState<SortDir>(() => getInitialFilters().sortDir)

  useEffect(() => {
    if (user?.id && selectedAccountId) fetchTrades(user.id, selectedAccountId)
  }, [user?.id, selectedAccountId, fetchTrades])

  // Persist filters/sort whenever they change
  useEffect(() => {
    const payload = {
      search,
      assetFilter,
      statusFilter,
      dirFilter,
      gradeFilter,
      sortKey,
      sortDir,
    }
    try {
      window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // ignore storage failures
    }
  }, [search, assetFilter, statusFilter, dirFilter, gradeFilter, sortKey, sortDir])

  const filtered = useMemo(() => {
    let result = [...trades]

    if (exitDateFilter) {
      result = result.filter(
        (t) => t.status === 'closed' && !!t.exit_date && t.exit_date.slice(0, 10) === exitDateFilter
      )
    }

    if (exitDateFromFilter && exitDateToFilter) {
      result = result.filter((t) => {
        if (t.status !== 'closed' || !t.exit_date) return false
        const day = t.exit_date.slice(0, 10)
        return day >= exitDateFromFilter && day <= exitDateToFilter
      })
    }

    if (!hasChartDrilldown && search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.ticker.toLowerCase().includes(q) ||
          t.strategy_tags?.some((tag) => tag.includes(q)) ||
          t.setup_notes?.toLowerCase().includes(q)
      )
    }
    if (!hasChartDrilldown && assetFilter !== 'all') result = result.filter((t) => t.asset_type === assetFilter)
    if (!hasChartDrilldown && statusFilter !== 'all') result = result.filter((t) => t.status === statusFilter)
    if (!hasChartDrilldown && dirFilter !== 'all') result = result.filter((t) => t.direction === dirFilter)
    if (!hasChartDrilldown && gradeFilter !== 'all') {
      if (gradeFilter === '-') {
        result = result.filter((t) => !t.ai_grade)
      } else {
        result = result.filter((t) => t.ai_grade?.startsWith(gradeFilter))
      }
    }

    result.sort((a, b) => {
      let av: number | string = 0
      let bv: number | string = 0
      switch (sortKey) {
        case 'entry_date':
          av = a.entry_date ?? ''
          bv = b.entry_date ?? ''
          break
        case 'net_pnl':
          av = a.net_pnl ?? -Infinity
          bv = b.net_pnl ?? -Infinity
          break
        case 'pnl_percent':
          av = calcPnlPercent(a) ?? -Infinity
          bv = calcPnlPercent(b) ?? -Infinity
          break
        case 'r_multiple':
          av = a.r_multiple ?? -Infinity
          bv = b.r_multiple ?? -Infinity
          break
        case 'ticker':
          av = a.ticker
          bv = b.ticker
          break
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [
    trades,
    exitDateFilter,
    exitDateFromFilter,
    exitDateToFilter,
    hasChartDrilldown,
    search,
    assetFilter,
    statusFilter,
    dirFilter,
    gradeFilter,
    sortKey,
    sortDir,
  ])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortKey === k ? 'text-primary' : ''}`} />
    </button>
  )

  return (
    <div className="p-6 space-y-4 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display tracking-wider">TRADES</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {filtered.length} of {trades.length} trades
          </p>
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <button
              onClick={() => exportToCsv(filtered)}
              className="flex items-center gap-2 border border-border rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title={`Export ${filtered.length} trade${filtered.length !== 1 ? 's' : ''} to CSV`}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}
          <button
            onClick={() => navigate('/trades/new')}
            className="flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Log Trade
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-lg border border-border bg-card space-y-3">
        {hasChartDrilldown && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
            <p className="text-xs text-foreground/90">
              {exitDateFilter && (
                <>Showing trades contributing to {drilldownLabel} bar for <span className="font-semibold">{exitDateFilter}</span></>
              )}
              {!exitDateFilter && exitDateFromFilter && exitDateToFilter && (
                <>Showing trades contributing to {drilldownLabel} range <span className="font-semibold">{exitDateFromFilter}</span> to <span className="font-semibold">{exitDateToFilter}</span></>
              )}
            </p>
            <button
              onClick={() => {
                const next = new URLSearchParams(searchParams)
                next.delete('drilldown')
                next.delete('exitDate')
                next.delete('exitDateFrom')
                next.delete('exitDateTo')
                setSearchParams(next)
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Clear
            </button>
          </div>
        )}

        {/* Search (full-width) */}
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticker, strategy..."
            className="w-full bg-input border border-border rounded-md pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Filter buttons row */}
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-muted-foreground" />

          {/* Asset filter */}
          {(['all', 'stock', 'option', 'etf', 'crypto'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setAssetFilter(v)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                assetFilter === v ? 'bg-primary text-primary-foreground' : 'bg-input border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {v === 'all' ? 'All Assets' : v.toUpperCase()}
            </button>
          ))}

          <div className="w-px h-6 bg-border" />

          {/* Status */}
          {(['all', 'open', 'closed', 'partial'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                statusFilter === v ? 'bg-accent text-foreground border border-primary/50' : 'bg-input border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}

          <div className="w-px h-6 bg-border" />

          {/* Direction */}
          {(['all', 'long', 'short'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setDirFilter(v)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                dirFilter === v ? 'bg-accent text-foreground border border-primary/50' : 'bg-input border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}

          <div className="w-px h-6 bg-border" />

          {/* Grade filter */}
          {(['all', 'A', 'B', 'C', 'D', 'F', '-'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setGradeFilter(v)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                gradeFilter === v
                  ? 'bg-accent text-foreground border border-primary/50'
                  : 'bg-input border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {v === 'all' ? 'All Grades' : v === '-' ? '–' : v}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-accent/30">
          <div className="w-7" />
          <div className="flex-1">
            <SortBtn k="ticker" label="Ticker / Strategy" />
          </div>
          <div className="hidden md:block w-48 text-right">
            <SortBtn k="entry_date" label="Date / Price" />
          </div>
          <div className="hidden lg:block w-16 text-right">
            <span className="text-xs text-muted-foreground">Qty</span>
          </div>
          <div className="hidden lg:block w-28 text-right">
            <span className="text-xs text-muted-foreground">Buy</span>
          </div>
          <div className="hidden lg:block w-28 text-right">
            <span className="text-xs text-muted-foreground">Sell</span>
          </div>
          <div className="w-24 text-right">
            <SortBtn k="net_pnl" label="P&L" />
          </div>
          <div className="hidden lg:block w-20 text-right">
            <SortBtn k="pnl_percent" label="P&L %" />
          </div>
          <div className="hidden lg:block w-16 text-right">
            <SortBtn k="r_multiple" label="R" />
          </div>
          <div className="hidden lg:block w-16 text-right" >
            <span className="sr-only text-xs text-muted-foreground">Grade</span>
          </div>
        </div>

        {loading && trades.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground text-sm">No trades match your filters.</p>
          </div>
        ) : (
          filtered.map((trade) => (
            <TradeRow
              key={trade.id}
              trade={trade}
              onClick={() => navigate(`/trades/${trade.id}`)}
            />
          ))
        )}
      </div>
    </div>
  )
}
