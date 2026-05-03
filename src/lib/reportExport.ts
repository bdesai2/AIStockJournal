interface ReportWindowOptions {
  title: string
  fileName: string
  bodyHtml: string
}

function openPrintWindow({ title, fileName, bodyHtml }: ReportWindowOptions): void {
  const report = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
      h1 { margin: 0 0 8px; font-size: 22px; }
      h2 { margin: 24px 0 8px; font-size: 16px; }
      .meta { color: #4b5563; font-size: 12px; margin-bottom: 16px; }
      .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 12px 0 20px; }
      .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; }
      .label { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; }
      .value { font-size: 18px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 12px; }
      th { background: #f9fafb; }
      .right { text-align: right; }
      .muted { color: #6b7280; }
      @media print {
        body { margin: 12mm; }
      }
    </style>
  </head>
  <body>
    ${bodyHtml}
    <script>
      setTimeout(function () { window.print(); }, 250);
    </script>
  </body>
</html>
`

  const blob = new Blob([report], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const tab = window.open(url, '_blank', 'noopener,noreferrer')
  if (!tab) {
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

const currency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)

interface PeriodRow {
  label: string
  pnl: number
  count: number
  winRate: number
}

interface PerformanceReportInput {
  title: string
  periodLabel: string
  generatedAt: string
  totalPnL: number
  totalTrades: number
  winRatePercent: number
  rows: PeriodRow[]
}

function exportPerformanceReport(input: PerformanceReportInput, fileName: string) {
  const rowsHtml = input.rows
    .map(
      (row) => `
      <tr>
        <td>${row.label}</td>
        <td class="right">${currency(row.pnl)}</td>
        <td class="right">${row.count}</td>
        <td class="right">${row.winRate}%</td>
      </tr>
    `
    )
    .join('')

  const body = `
    <h1>${input.title}</h1>
    <p class="meta">Period: ${input.periodLabel} | Generated: ${input.generatedAt}</p>

    <div class="cards">
      <div class="card"><div class="label">Total PnL</div><div class="value">${currency(input.totalPnL)}</div></div>
      <div class="card"><div class="label">Closed Trades</div><div class="value">${input.totalTrades}</div></div>
      <div class="card"><div class="label">Win Rate</div><div class="value">${input.winRatePercent.toFixed(1)}%</div></div>
    </div>

    <h2>Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>Period</th>
          <th class="right">PnL</th>
          <th class="right">Trades</th>
          <th class="right">Win Rate</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="4" class="muted">No data available.</td></tr>'}
      </tbody>
    </table>
  `

  openPrintWindow({ title: input.title, fileName, bodyHtml: body })
}

export function exportMonthlyPerformanceReport(input: Omit<PerformanceReportInput, 'title'>) {
  exportPerformanceReport({ ...input, title: 'Monthly Performance Report' }, 'monthly-performance-report')
}

export function exportQuarterlyPerformanceReport(input: Omit<PerformanceReportInput, 'title'>) {
  exportPerformanceReport({ ...input, title: 'Quarterly Performance Report' }, 'quarterly-performance-report')
}

interface JournalDayRow {
  date: string
  pnl: number
  tradeCount: number
  marketMood?: string
  personalMood?: number
  reviewedRules?: boolean
}

interface JournalReportInput {
  monthLabel: string
  generatedAt: string
  totalPnL: number
  totalTrades: number
  journalEntries: number
  rows: JournalDayRow[]
}

export function exportMonthlyJournalReport(input: JournalReportInput) {
  const rowsHtml = input.rows
    .map(
      (row) => `
      <tr>
        <td>${row.date}</td>
        <td class="right">${currency(row.pnl)}</td>
        <td class="right">${row.tradeCount}</td>
        <td>${row.marketMood ?? '—'}</td>
        <td class="right">${row.personalMood ?? '—'}</td>
        <td>${row.reviewedRules ? 'Yes' : 'No'}</td>
      </tr>
    `
    )
    .join('')

  const body = `
    <h1>Monthly Journal Report</h1>
    <p class="meta">Month: ${input.monthLabel} | Generated: ${input.generatedAt}</p>

    <div class="cards">
      <div class="card"><div class="label">Monthly PnL</div><div class="value">${currency(input.totalPnL)}</div></div>
      <div class="card"><div class="label">Closed Trades</div><div class="value">${input.totalTrades}</div></div>
      <div class="card"><div class="label">Journal Entries</div><div class="value">${input.journalEntries}</div></div>
    </div>

    <h2>Daily Journal Summary</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th class="right">PnL</th>
          <th class="right">Trades</th>
          <th>Market Mood</th>
          <th class="right">Personal Mood</th>
          <th>Rules Reviewed</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="6" class="muted">No entries for this month.</td></tr>'}
      </tbody>
    </table>
  `

  openPrintWindow({
    title: 'Monthly Journal Report',
    fileName: 'monthly-journal-report',
    bodyHtml: body,
  })
}
