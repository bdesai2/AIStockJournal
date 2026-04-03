import express from 'express'

const app = express()
const PORT = process.env.PORT || 3001

// Simple health check
app.get('/health', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.json({ status: 'ok' })
})

// Proxy Yahoo Finance sector lookup
app.get('/api/yahoo/sector/:ticker', async (req, res) => {
  const ticker = (req.params.ticker || '').toUpperCase()

  if (!ticker) {
    res.status(400).json({ error: 'Ticker is required' })
    return
  }

  try {
    const yahooUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      ticker,
    )}?modules=assetProfile`

    const response = await fetch(yahooUrl, {
      headers: {
        // Some Yahoo endpoints are picky about User-Agent; use a browser-like one
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/json, text/javascript, */*; q=0.01',
      },
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error(
        'Yahoo request failed:',
        response.status,
        response.statusText,
        text.slice(0, 200),
      )
      res.status(response.status).json({ error: 'Yahoo request failed' })
      return
    }

    const json = await response.json()
    const sector =
      json?.quoteSummary?.result?.[0]?.assetProfile?.sector ?? null

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.json({ sector })
  } catch (err) {
    console.error('Error calling Yahoo Finance:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.listen(PORT, () => {
  console.log(`Yahoo proxy server listening on http://localhost:${PORT}`)
})
