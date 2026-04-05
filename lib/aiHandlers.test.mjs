import { describe, it, expect } from 'vitest'
import {
  buildGradePrompt,
  parseGradeResponse,
  buildSetupCheckPrompt,
  parseSetupCheckResponse,
  buildTradePrompt,
  parseTradeAnalysisResponse,
  buildDigestPrompt,
  parseDigestResponse,
  buildPotentialTradePrompt,
} from './aiHandlers.mjs'

describe('AI Handlers', () => {
  describe('buildGradePrompt', () => {
    it('builds a valid grade prompt with all fields', () => {
      const trade = {
        ticker: 'AAPL',
        asset_type: 'stock',
        direction: 'long',
        entry_price: 150,
        exit_price: 155,
        entry_date: '2024-01-01',
        exit_date: '2024-01-05',
        quantity: 10,
        net_pnl: 50,
        r_multiple: 1.5,
        stop_loss: 145,
        take_profit: 160,
        strategy_tags: ['momentum', 'technical'],
        setup_notes: 'Strong breakout',
        mistakes: 'Held too long',
        emotional_state: 'confident',
        execution_quality: 9,
      }

      const prompt = buildGradePrompt(trade)
      expect(prompt).toContain('AAPL')
      expect(prompt).toContain('stock')
      expect(prompt).toContain('long')
      expect(prompt).toContain('150')
      expect(prompt).toContain('Strong breakout')
      expect(prompt).toContain('momentum, technical')
    })

    it('calculates risk/reward ratio when stop loss and take profit are set', () => {
      const trade = {
        ticker: 'TEST',
        asset_type: 'stock',
        direction: 'long',
        entry_price: 100,
        exit_price: 105,
        entry_date: '2024-01-01',
        exit_date: '2024-01-02',
        quantity: 1,
        stop_loss: 95,
        take_profit: 110,
      }

      const prompt = buildGradePrompt(trade)
      // RR = (110 - 100) / (100 - 95) = 10/5 = 2.00
      expect(prompt).toContain('2.00')
    })

    it('shows "N/A" for risk/reward when stop loss or take profit missing', () => {
      const trade = {
        ticker: 'TEST',
        asset_type: 'stock',
        direction: 'long',
        entry_price: 100,
        exit_price: 105,
        entry_date: '2024-01-01',
        exit_date: '2024-01-02',
        quantity: 1,
      }

      const prompt = buildGradePrompt(trade)
      expect(prompt).toContain('Risk/Reward Ratio: N/A')
    })

    it('handles missing optional fields gracefully', () => {
      const trade = {
        ticker: 'TEST',
        asset_type: 'stock',
        direction: 'long',
        entry_price: 100,
        exit_price: 105,
        entry_date: '2024-01-01',
        exit_date: '2024-01-02',
        quantity: 1,
      }

      const prompt = buildGradePrompt(trade)
      expect(prompt).toContain('none')
      expect(prompt).toContain('not set')
    })
  })

  describe('parseGradeResponse', () => {
    it('parses a valid grade response', () => {
      const raw = JSON.stringify({
        grade: 'A',
        setup_score: 85,
        rationale: 'Strong entry point with good risk/reward',
        suggestions: ['Improve exit timing', 'Watch macro events'],
      })

      const result = parseGradeResponse(raw)
      expect(result.grade).toBe('A')
      expect(result.setup_score).toBe(85)
      expect(result.rationale).toBe('Strong entry point with good risk/reward')
      expect(result.suggestions).toEqual(['Improve exit timing', 'Watch macro events'])
    })

    it('defaults to "C" grade when missing', () => {
      const result = parseGradeResponse('{}')
      expect(result.grade).toBe('C')
    })

    it('clamps setup_score between 0 and 100', () => {
      expect(parseGradeResponse('{"setup_score": -10}').setup_score).toBe(0)
      expect(parseGradeResponse('{"setup_score": 150}').setup_score).toBe(100)
      expect(parseGradeResponse('{"setup_score": 50}').setup_score).toBe(50)
    })

    it('handles empty suggestions array', () => {
      const result = parseGradeResponse('{"suggestions": []}')
      expect(result.suggestions).toEqual([])
    })
  })

  describe('buildSetupCheckPrompt', () => {
    it('builds setup check prompt with complete parameters', () => {
      const prompt = buildSetupCheckPrompt({
        ticker: 'AAPL',
        entry_price: 150,
        stop_loss: 145,
        take_profit: 160,
        direction: 'long',
        quantity: 10,
      })

      expect(prompt).toContain('AAPL')
      expect(prompt).toContain('150')
      expect(prompt).toContain('145')
      expect(prompt).toContain('160')
      expect(prompt).toContain('long')
      expect(prompt).toContain('10')
    })

    it('calculates risk/reward correctly', () => {
      const prompt = buildSetupCheckPrompt({
        ticker: 'TEST',
        entry_price: 100,
        stop_loss: 95,
        take_profit: 110,
      })

      // RR = (110 - 100) / (100 - 95) = 10/5 = 2.00
      expect(prompt).toContain('2.00')
    })

    it('shows "cannot calculate" when stop loss not set', () => {
      const prompt = buildSetupCheckPrompt({
        ticker: 'TEST',
        entry_price: 100,
        take_profit: 110,
      })

      expect(prompt).toContain('cannot calculate')
    })
  })

  describe('parseSetupCheckResponse', () => {
    it('parses a valid setup check response', () => {
      const raw = JSON.stringify({
        rr_rating: 'good',
        rr_comment: 'Risk reward ratio is favorable',
        setup_quality: 'strong',
        setup_comment: 'Setup shows good structure',
        position_size_note: 'Consider 10 shares',
        warnings: [],
      })

      const result = parseSetupCheckResponse(raw)
      expect(result.rr_rating).toBe('good')
      expect(result.setup_quality).toBe('strong')
      expect(result.position_size_note).toBe('Consider 10 shares')
      expect(result.warnings).toEqual([])
    })

    it('provides sensible defaults for missing fields', () => {
      const result = parseSetupCheckResponse('{}')
      expect(result.rr_rating).toBe('acceptable')
      expect(result.setup_quality).toBe('moderate')
      expect(result.warnings).toEqual([])
    })
  })

  describe('buildTradePrompt', () => {
    it('builds a complete trade analysis prompt', () => {
      const trade = {
        ticker: 'AAPL',
        asset_type: 'stock',
        direction: 'long',
        entry_date: '2024-01-01',
        entry_price: 150,
        quantity: 10,
        stop_loss: 145,
        take_profit: 160,
        setup_notes: 'Breakout from consolidation',
      }

      const prompt = buildTradePrompt(trade)
      expect(prompt).toContain('AAPL')
      expect(prompt).toContain('150')
      expect(prompt).toContain('1500') // 150 * 10
      expect(prompt).toContain('Breakout from consolidation')
    })

    it('escapes special characters in setup notes', () => {
      const trade = {
        ticker: 'TEST',
        asset_type: 'stock',
        direction: 'long',
        entry_date: '2024-01-01',
        entry_price: 100,
        quantity: 1,
        setup_notes: 'Notes with "quotes" and\nnewlines',
      }

      const prompt = buildTradePrompt(trade)
      // Should have escaped quotes (to \") and replaced newlines with spaces
      expect(prompt).toContain('\\\"quotes\\\"')
      expect(prompt).toContain('and newlines') // newline converted to space
    })
  })

  describe('parseTradeAnalysisResponse', () => {
    it('parses a valid trade analysis response', () => {
      const raw = JSON.stringify({
        market_overview: 'Market showing strength',
        current_price_estimate: 155,
        estimated_pnl: 50,
        estimated_pnl_percent: 3.33,
        bullish_factors: ['Strong earnings', 'Technical breakout'],
        bearish_factors: ['Rising rates'],
        technical_outlook: 'Bullish trend',
        recommendation: 'hold',
        confidence: 'high',
        next_key_levels: { resistance: 160, support: 150 },
      })

      const result = parseTradeAnalysisResponse(raw)
      expect(result.market_overview).toBe('Market showing strength')
      expect(result.current_price_estimate).toBe(155)
      expect(result.recommendation).toBe('hold')
      expect(result.confidence).toBe('high')
      expect(result.next_key_levels.resistance).toBe(160)
    })

    it('defaults to "hold" for invalid recommendations', () => {
      const result = parseTradeAnalysisResponse('{"recommendation": "invalid"}')
      expect(result.recommendation).toBe('hold')
    })

    it('converts string numbers to actual numbers', () => {
      const raw = JSON.stringify({
        current_price_estimate: '155',
        estimated_pnl: '50',
      })

      const result = parseTradeAnalysisResponse(raw)
      expect(typeof result.current_price_estimate).toBe('number')
      expect(result.current_price_estimate).toBe(155)
    })
  })

  describe('buildDigestPrompt', () => {
    it('builds a digest prompt from closed trades', () => {
      const trades = [
        {
          ticker: 'AAPL',
          direction: 'long',
          strategy_tags: ['momentum'],
          net_pnl: 100,
          r_multiple: 1.5,
          emotional_state: 'confident',
          mistakes: 'None',
        },
        {
          ticker: 'TSLA',
          direction: 'short',
          strategy_tags: [],
          net_pnl: -50,
          r_multiple: -0.8,
          emotional_state: 'frustrated',
          mistakes: 'Entered early',
        },
      ]

      const prompt = buildDigestPrompt(trades)
      expect(prompt).toContain('AAPL')
      expect(prompt).toContain('TSLA')
      expect(prompt).toContain('momentum')
      expect(prompt).toContain('100.00')
      expect(prompt).toContain('1/2 wins')
      expect(prompt).toContain('50.00') // Total P&L
    })

    it('handles trades with missing optional fields', () => {
      const trades = [{ ticker: 'TEST', direction: 'long' }]
      const prompt = buildDigestPrompt(trades)
      expect(prompt).toContain('TEST')
      expect(prompt).toContain('N/A')
    })

    it('limits summary to first 30 trades', () => {
      const trades = Array.from({ length: 40 }, (_, i) => ({
        ticker: `T${i}`,
        direction: 'long',
        net_pnl: 10,
      }))

      const prompt = buildDigestPrompt(trades)
      expect(prompt).toContain('T0')
      expect(prompt).toContain('T29')
      expect(prompt).not.toContain('T30')
    })
  })

  describe('parseDigestResponse', () => {
    it('parses a valid digest response', () => {
      const raw = JSON.stringify({
        positive_patterns: [
          { pattern: 'Winning streak', detail: 'Strong momentum trades' },
        ],
        negative_patterns: [
          { pattern: 'Over-trading', detail: 'Too many setups per week' },
        ],
        actionable_lesson: 'Focus on quality over quantity',
      })

      const result = parseDigestResponse(raw)
      expect(result.positive_patterns).toHaveLength(1)
      expect(result.negative_patterns).toHaveLength(1)
      expect(result.actionable_lesson).toBe('Focus on quality over quantity')
    })

    it('provides empty defaults for missing fields', () => {
      const result = parseDigestResponse('{}')
      expect(result.positive_patterns).toEqual([])
      expect(result.negative_patterns).toEqual([])
      expect(result.actionable_lesson).toBe('')
    })
  })

  describe('buildPotentialTradePrompt', () => {
    it('builds a potential trade prompt', () => {
      const prompt = buildPotentialTradePrompt({
        symbol: 'AAPL',
        market_type: 'stock',
        direction: 'long',
        proposed_entry: 150,
        stop_level: 145,
        target_level: 160,
        notes: 'Breakout setup',
      })

      expect(prompt).toContain('AAPL')
      expect(prompt).toContain('150')
      expect(prompt).toContain('145')
      expect(prompt).toContain('160')
      expect(prompt).toContain('Breakout setup')
    })

    it('calculates R/R for potential trades', () => {
      const prompt = buildPotentialTradePrompt({
        symbol: 'TEST',
        proposed_entry: 100,
        stop_level: 95,
        target_level: 110,
      })

      // RR = (110 - 100) / (100 - 95) = 2.00
      expect(prompt).toContain('2.00')
    })

    it('handles short positions with negative values', () => {
      const prompt = buildPotentialTradePrompt({
        symbol: 'TEST',
        direction: 'short',
        proposed_entry: 100,
        stop_level: 110,
        target_level: 90,
      })

      expect(prompt).toContain('short')
      expect(prompt).toContain('100')
    })
  })
})
