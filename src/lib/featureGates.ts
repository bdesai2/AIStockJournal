import { useAuthStore } from '@/store/authStore'

export type Tier = 'free' | 'pro'

export interface FeatureGate {
  key: string
  name: string
  description: string
  tier: Tier[]
  category: 'ai' | 'analytics' | 'strategy' | 'core'
}

/**
 * Define all gated features
 * Tiers determine which tier(s) have access to this feature
 */
export const FEATURES: Record<string, FeatureGate> = {
  // AI Features (Pro only)
  TRADE_GRADING: {
    key: 'TRADE_GRADING',
    name: 'Trade Grading',
    description: 'AI-powered trade analysis with letter grades and suggestions',
    tier: ['pro'],
    category: 'ai',
  },
  SETUP_VALIDATION: {
    key: 'SETUP_VALIDATION',
    name: 'Setup Validation',
    description: 'Pre-trade quality checks and risk/reward assessment',
    tier: ['pro'],
    category: 'ai',
  },
  WEEKLY_DIGEST: {
    key: 'WEEKLY_DIGEST',
    name: 'Weekly Digest',
    description: 'AI-generated pattern analysis and actionable lessons',
    tier: ['pro'],
    category: 'ai',
  },
  OPEN_TRADE_ANALYSIS: {
    key: 'OPEN_TRADE_ANALYSIS',
    name: 'Open Trade Analysis',
    description: 'Real-time AI analysis of active positions',
    tier: ['pro'],
    category: 'ai',
  },
  POTENTIAL_TRADE_EVALUATION: {
    key: 'POTENTIAL_TRADE_EVALUATION',
    name: 'Trade Evaluation',
    description: 'Evaluate trade ideas before logging them',
    tier: ['pro'],
    category: 'ai',
  },

  // Advanced Analytics (Pro only)
  ADVANCED_METRICS: {
    key: 'ADVANCED_METRICS',
    name: 'Advanced Metrics',
    description: 'Sharpe ratio, Sortino ratio, drawdown, recovery factor',
    tier: ['pro'],
    category: 'analytics',
  },
  HEATMAP: {
    key: 'HEATMAP',
    name: 'P&L Heatmap',
    description: '52-week P&L activity visualization',
    tier: ['pro'],
    category: 'analytics',
  },
  DIMENSIONAL_ANALYSIS: {
    key: 'DIMENSIONAL_ANALYSIS',
    name: 'Dimensional Analysis',
    description: 'Breakdown by strategy, sector, timeframe, emotional state, and more',
    tier: ['pro'],
    category: 'analytics',
  },
  TIME_OF_DAY_ANALYSIS: {
    key: 'TIME_OF_DAY_ANALYSIS',
    name: 'Time-of-Day Analysis',
    description: 'Performance by time buckets (overnight, premarket, etc)',
    tier: ['pro'],
    category: 'analytics',
  },
  MONTHLY_QUARTERLY_REPORTS: {
    key: 'MONTHLY_QUARTERLY_REPORTS',
    name: 'Monthly/Quarterly Reports',
    description: 'Month-over-month and quarterly trend analysis',
    tier: ['pro'],
    category: 'analytics',
  },
  TRADE_SIMILARITY_MATCHING: {
    key: 'TRADE_SIMILARITY_MATCHING',
    name: 'Trade Similarity Matching',
    description: 'Find similar past trades based on setup and execution',
    tier: ['pro'],
    category: 'analytics',
  },

  // Strategy Library (Pro only)
  STRATEGY_LIBRARY: {
    key: 'STRATEGY_LIBRARY',
    name: 'Strategy Library',
    description: 'Create, edit, and manage custom trading strategies',
    tier: ['pro'],
    category: 'strategy',
  },

  // Core Features (Free)
  TRADE_LOGGING: {
    key: 'TRADE_LOGGING',
    name: 'Trade Logging',
    description: 'Log and track all your trades',
    tier: ['free', 'pro'],
    category: 'core',
  },
  MULTI_ACCOUNT: {
    key: 'MULTI_ACCOUNT',
    name: 'Multiple Accounts',
    description: 'Manage multiple trading accounts',
    tier: ['free', 'pro'],
    category: 'core',
  },
  BASIC_STATS: {
    key: 'BASIC_STATS',
    name: 'Basic Statistics',
    description: 'P&L, win rate, profit factor, average R-multiple',
    tier: ['free', 'pro'],
    category: 'core',
  },
  BASIC_CHARTS: {
    key: 'BASIC_CHARTS',
    name: 'Basic Charts',
    description: 'P&L curve, daily bars, by strategy/asset type',
    tier: ['free', 'pro'],
    category: 'core',
  },
  DAILY_JOURNAL: {
    key: 'DAILY_JOURNAL',
    name: 'Daily Journal',
    description: 'Calendar view and daily trading notes',
    tier: ['free', 'pro'],
    category: 'core',
  },
  DATA_EXPORT: {
    key: 'DATA_EXPORT',
    name: 'Data Export',
    description: 'Export trades as JSON or CSV',
    tier: ['free', 'pro'],
    category: 'core',
  },
}

/**
 * Check if a user has access to a specific feature
 * Can be used in React components with the hook version, or as a regular function
 * @param featureKey - The feature key (e.g., 'TRADE_GRADING')
 * @param userTier - The user's current tier ('free' or 'pro')
 * @returns boolean - Whether the user has access to this feature
 */
export function canAccess(featureKey: string, userTier: Tier): boolean {
  const feature = FEATURES[featureKey]
  if (!feature) {
    console.warn(`Feature '${featureKey}' not found in feature gates`)
    return false
  }

  return feature.tier.includes(userTier)
}

/**
 * Hook version - use in React components when you need dynamic tier access
 * @param featureKey - The feature key (e.g., 'TRADE_GRADING')
 * @param userTier - Optional override tier, otherwise uses auth store
 * @returns boolean - Whether the user has access to this feature
 */
export function useCanAccess(featureKey: string, userTier?: Tier): boolean {
  const { subscription } = useAuthStore()
  const tier = userTier || subscription?.tier || 'free'
  return canAccess(featureKey, tier)
}

/**
 * Get all features available for a tier
 */
export function getFeaturesForTier(tier: Tier): FeatureGate[] {
  return Object.values(FEATURES).filter((feature) => feature.tier.includes(tier))
}

/**
 * Get all Pro-only features
 */
export function getProFeatures(): FeatureGate[] {
  return Object.values(FEATURES).filter((feature) => feature.tier.includes('pro'))
}

/**
 * Get all core features
 */
export function getCoreFeatures(): FeatureGate[] {
  return Object.values(FEATURES).filter((feature) => feature.category === 'core')
}

/**
 * Get features by category
 */
export function getFeaturesByCategory(
  category: 'ai' | 'analytics' | 'strategy' | 'core'
): FeatureGate[] {
  return Object.values(FEATURES).filter((feature) => feature.category === category)
}

/**
 * Check if a feature is AI-powered
 */
export function isAIFeature(featureKey: string): boolean {
  return FEATURES[featureKey]?.category === 'ai'
}

/**
 * Check if a feature is analytics
 */
export function isAnalyticsFeature(featureKey: string): boolean {
  return FEATURES[featureKey]?.category === 'analytics'
}

/**
 * Get feature by key
 */
export function getFeature(featureKey: string): FeatureGate | undefined {
  return FEATURES[featureKey]
}

/**
 * Hook to get upgrade suggestion message
 */
export function getUpgradeMessage(featureKey: string): string {
  const feature = getFeature(featureKey)
  if (!feature) return 'Upgrade to Pro to access this feature'

  if (feature.category === 'ai') {
    return `Upgrade to Pro to enable ${feature.name} and other AI features`
  } else if (feature.category === 'analytics') {
    return `Upgrade to Pro to unlock advanced analytics including ${feature.name}`
  } else if (feature.category === 'strategy') {
    return 'Upgrade to Pro to create and manage custom trading strategies'
  }

  return `Upgrade to Pro to access ${feature.name}`
}

export type { FeatureGate }
