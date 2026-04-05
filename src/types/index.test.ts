import { describe, it, expect } from 'vitest'
import type {
  Trade,
  TradeExecution,
  OptionLeg,
  AssetType,
  OptionType,
  OptionAction,
} from './index'

describe('Trade Execution Types', () => {
  describe('TradeExecution', () => {
    it('supports standard buy/sell executions', () => {
      const execution: TradeExecution = {
        id: 'exec-1',
        trade_id: 'trade-1',
        user_id: 'user-1',
        action: 'buy',
        datetime: '2024-01-01T10:00:00Z',
        quantity: 100,
        price: 150.5,
        fee: 10,
        created_at: '2024-01-01T10:00:00Z',
      }

      expect(execution.action).toBe('buy')
      expect(execution.quantity).toBe(100)
      expect(execution.price).toBe(150.5)
    })

    it('supports dividend executions', () => {
      const execution: TradeExecution = {
        id: 'exec-2',
        trade_id: 'trade-1',
        user_id: 'user-1',
        action: 'buy',
        datetime: '2024-01-15T15:30:00Z',
        quantity: 100,
        price: 0, // Dividend is recorded as an execution with 0 price
        dividend: 25, // Dividend amount in dollars
        created_at: '2024-01-15T15:30:00Z',
      }

      expect(execution.dividend).toBe(25)
      expect(execution.quantity).toBe(100)
    })

    it('supports optional fee tracking', () => {
      const executionWithFee: TradeExecution = {
        id: 'exec-3',
        trade_id: 'trade-1',
        user_id: 'user-1',
        action: 'sell',
        datetime: '2024-01-05T14:00:00Z',
        quantity: 100,
        price: 155,
        fee: 10.5,
        created_at: '2024-01-05T14:00:00Z',
      }

      const executionWithoutFee: TradeExecution = {
        id: 'exec-4',
        trade_id: 'trade-1',
        user_id: 'user-1',
        action: 'sell',
        datetime: '2024-01-05T14:00:00Z',
        quantity: 100,
        price: 155,
        created_at: '2024-01-05T14:00:00Z',
      }

      expect(executionWithFee.fee).toBe(10.5)
      expect(executionWithoutFee.fee).toBeUndefined()
    })
  })

  describe('OptionLeg', () => {
    it('supports call option legs', () => {
      const callLeg: OptionLeg = {
        id: 'leg-1',
        action: 'buy',
        option_type: 'call',
        strike: 150,
        expiration: '2024-02-16',
        contracts: 1,
        premium: 2.5,
        delta: 0.65,
        iv: 0.25,
      }

      expect(callLeg.option_type).toBe('call')
      expect(callLeg.strike).toBe(150)
      expect(callLeg.premium).toBe(2.5)
      expect(callLeg.delta).toBe(0.65)
    })

    it('supports put option legs', () => {
      const putLeg: OptionLeg = {
        id: 'leg-2',
        action: 'sell',
        option_type: 'put',
        strike: 145,
        expiration: '2024-02-16',
        contracts: 1,
        premium: 1.8,
        delta: -0.35,
        iv: 0.28,
      }

      expect(putLeg.option_type).toBe('put')
      expect(putLeg.action).toBe('sell')
      expect(putLeg.contracts).toBe(1)
    })

    it('supports optional Greeks (delta, IV)', () => {
      const legWithGreeks: OptionLeg = {
        action: 'buy',
        option_type: 'call',
        strike: 150,
        expiration: '2024-02-16',
        contracts: 2,
        premium: 3.5,
        delta: 0.7,
        iv: 0.35,
      }

      const legWithoutGreeks: OptionLeg = {
        action: 'sell',
        option_type: 'put',
        strike: 140,
        expiration: '2024-02-16',
        contracts: 1,
        premium: 2.0,
      }

      expect(legWithGreeks.delta).toBe(0.7)
      expect(legWithoutGreeks.delta).toBeUndefined()
      expect(legWithGreeks.iv).toBe(0.35)
      expect(legWithoutGreeks.iv).toBeUndefined()
    })
  })

  describe('Trade with Options', () => {
    it('supports option trades with multiple legs', () => {
      const trade: Trade = {
        id: 'trade-1',
        user_id: 'user-1',
        ticker: 'AAPL',
        asset_type: 'option',
        direction: 'long',
        status: 'closed',
        entry_date: '2024-01-01T10:00:00Z',
        exit_date: '2024-02-16T15:00:00Z',
        entry_price: 2.5, // Debit paid for spread
        exit_price: 4.5,
        quantity: 1, // 1 spread = 1 contract pairing
        fees: 20,
        gross_pnl: 200,
        net_pnl: 180,
        pnl_percent: 72,
        option_type: 'call',
        option_strategy: 'Bull Call Spread',
        option_legs: [
          {
            action: 'buy',
            option_type: 'call',
            strike: 150,
            expiration: '2024-02-16',
            contracts: 1,
            premium: 3.5,
            delta: 0.65,
          },
          {
            action: 'sell',
            option_type: 'call',
            strike: 155,
            expiration: '2024-02-16',
            contracts: 1,
            premium: 1.0,
            delta: 0.25,
          },
        ],
        strategy_tags: ['vertical_spread'],
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-02-16T15:00:00Z',
      }

      expect(trade.asset_type).toBe('option')
      expect(trade.option_strategy).toBe('Bull Call Spread')
      expect(trade.option_legs).toHaveLength(2)
      expect(trade.option_legs[0].action).toBe('buy')
      expect(trade.option_legs[1].action).toBe('sell')
    })

    it('supports iron condor (4-leg option strategy)', () => {
      const trade: Trade = {
        id: 'trade-2',
        user_id: 'user-1',
        ticker: 'SPY',
        asset_type: 'option',
        direction: 'short',
        status: 'open',
        entry_date: '2024-01-01T09:30:00Z',
        entry_price: 2.0, // Credit received
        quantity: 1,
        option_type: 'call',
        option_strategy: 'Iron Condor',
        option_legs: [
          {
            action: 'sell',
            option_type: 'call',
            strike: 475,
            expiration: '2024-02-16',
            contracts: 1,
            premium: 1.5,
          },
          {
            action: 'buy',
            option_type: 'call',
            strike: 480,
            expiration: '2024-02-16',
            contracts: 1,
            premium: 0.5,
          },
          {
            action: 'sell',
            option_type: 'put',
            strike: 460,
            expiration: '2024-02-16',
            contracts: 1,
            premium: 1.5,
          },
          {
            action: 'buy',
            option_type: 'put',
            strike: 455,
            expiration: '2024-02-16',
            contracts: 1,
            premium: 0.5,
          },
        ],
        strategy_tags: ['iron_condor'],
        created_at: '2024-01-01T09:30:00Z',
        updated_at: '2024-01-01T09:30:00Z',
      }

      expect(trade.option_legs).toHaveLength(4)
      expect(trade.option_strategy).toBe('Iron Condor')
      const allActions = trade.option_legs.map(l => l.action)
      expect(allActions).toEqual(['sell', 'buy', 'sell', 'buy'])
    })
  })

  describe('Dividend Execution Support', () => {
    it('tracks dividends as separate executions', () => {
      const trade: Trade = {
        id: 'trade-div',
        user_id: 'user-1',
        ticker: 'MSFT',
        asset_type: 'stock',
        direction: 'long',
        status: 'open',
        entry_date: '2024-01-01T10:00:00Z',
        entry_price: 400,
        quantity: 100,
        strategy_tags: [],
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
        executions: [
          {
            id: 'exec-buy',
            trade_id: 'trade-div',
            user_id: 'user-1',
            action: 'buy',
            datetime: '2024-01-01T10:00:00Z',
            quantity: 100,
            price: 400,
            fee: 10,
            created_at: '2024-01-01T10:00:00Z',
          },
          {
            id: 'exec-div',
            trade_id: 'trade-div',
            user_id: 'user-1',
            action: 'buy', // Dividends recorded as buy action with 0 price
            datetime: '2024-01-15T00:00:00Z',
            quantity: 100,
            price: 0,
            dividend: 150, // $1.50 per share × 100 shares
            created_at: '2024-01-15T00:00:00Z',
          },
        ],
        has_executions: true,
      }

      expect(trade.executions).toHaveLength(2)
      const divExecution = trade.executions?.find(e => e.dividend)
      expect(divExecution?.dividend).toBe(150)
      expect(divExecution?.price).toBe(0)
    })

    it('supports dividend-only positions', () => {
      const execution: TradeExecution = {
        id: 'exec-div-only',
        trade_id: 'trade-div',
        user_id: 'user-1',
        action: 'buy',
        datetime: '2024-01-15T00:00:00Z',
        quantity: 100,
        price: 0, // No buy price, just dividend
        dividend: 150,
        created_at: '2024-01-15T00:00:00Z',
      }

      expect(execution.dividend).toBe(150)
      expect(execution.quantity).toBe(100)
      expect(execution.price).toBe(0)
    })
  })

  describe('AssetType Support', () => {
    it('supports all asset types', () => {
      const assetTypes: AssetType[] = ['stock', 'option', 'etf', 'crypto']

      assetTypes.forEach(type => {
        expect(['stock', 'option', 'etf', 'crypto']).toContain(type)
      })
    })

    it('option trades require option-specific fields', () => {
      const optionTrade: Trade = {
        id: 'trade-opt',
        user_id: 'user-1',
        ticker: 'AAPL',
        asset_type: 'option',
        direction: 'long',
        status: 'closed',
        entry_date: '2024-01-01T10:00:00Z',
        entry_price: 2.5,
        quantity: 1,
        option_type: 'call', // Required for options
        option_legs: [
          {
            action: 'buy',
            option_type: 'call',
            strike: 150,
            expiration: '2024-02-16',
            contracts: 1,
            premium: 2.5,
          },
        ],
        strategy_tags: [],
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-02-16T00:00:00Z',
      }

      expect(optionTrade.asset_type).toBe('option')
      expect(optionTrade.option_type).toBe('call')
      expect(optionTrade.option_legs).toBeDefined()
    })
  })
})
