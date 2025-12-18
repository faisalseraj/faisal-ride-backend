/**
 * A/B Testing Framework for Ranking Algorithm Weight Tuning
 * Allows testing different weight configurations to optimize ranking performance
 */

export interface RankingWeights {
  proximity: number;
  routeFamiliarity: number;
  historyAffinity: number;
  time: number;
  quality: number;
  optimization: number;
  routePopularity?: number; // Optional new signal
}

export interface ABTestConfig {
  variant: 'A' | 'B' | 'C' | 'control';
  weights: RankingWeights;
  description: string;
  enabled: boolean;
  userPercentage?: number; // Percentage of users to include in test (0-100)
}

/**
 * Default weights (control variant)
 */
export const DEFAULT_WEIGHTS: RankingWeights = {
  proximity: 0.30,
  routeFamiliarity: 0.25,
  historyAffinity: 0.15,
  time: 0.15,
  quality: 0.10,
  optimization: 0.05,
  routePopularity: 0.0, // Not used by default
};

/**
 * Predefined A/B test variants
 */
export const AB_TEST_VARIANTS: Record<string, ABTestConfig> = {
  control: {
    variant: 'control',
    weights: DEFAULT_WEIGHTS,
    description: 'Default weights (control)',
    enabled: true,
    userPercentage: 100,
  },
  variantA: {
    variant: 'A',
    weights: {
      proximity: 0.35,
      routeFamiliarity: 0.20,
      historyAffinity: 0.15,
      time: 0.15,
      quality: 0.10,
      optimization: 0.05,
      routePopularity: 0.0,
    },
    description: 'Higher proximity weight',
    enabled: false,
    userPercentage: 10,
  },
  variantB: {
    variant: 'B',
    weights: {
      proximity: 0.25,
      routeFamiliarity: 0.30,
      historyAffinity: 0.15,
      time: 0.15,
      quality: 0.10,
      optimization: 0.05,
      routePopularity: 0.0,
    },
    description: 'Higher route familiarity weight',
    enabled: false,
    userPercentage: 10,
  },
  variantC: {
    variant: 'C',
    weights: {
      proximity: 0.25,
      routeFamiliarity: 0.20,
      historyAffinity: 0.15,
      time: 0.15,
      quality: 0.15,
      optimization: 0.05,
      routePopularity: 0.05, // Include route popularity
    },
    description: 'Include route popularity signal',
    enabled: false,
    userPercentage: 10,
  },
};

/**
 * Get weights for a user based on A/B test assignment
 * Uses consistent hashing to ensure same user always gets same variant
 */
export function getWeightsForUser(userId: string): RankingWeights {
  // Simple hash function for consistent assignment
  const hash = userId.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  const hashValue = Math.abs(hash) % 100;

  // Find enabled variants
  const enabledVariants = Object.values(AB_TEST_VARIANTS).filter(v => v.enabled);
  
  if (enabledVariants.length === 0) {
    return DEFAULT_WEIGHTS;
  }

  // Assign user to variant based on hash
  let cumulativePercentage = 0;
  for (const variant of enabledVariants) {
    const percentage = variant.userPercentage || 0;
    cumulativePercentage += percentage;
    
    if (hashValue < cumulativePercentage) {
      return variant.weights;
    }
  }

  // Fallback to control
  return DEFAULT_WEIGHTS;
}

/**
 * Get A/B test variant for a user (for analytics/tracking)
 */
export function getVariantForUser(userId: string): string {
  const hash = userId.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  const hashValue = Math.abs(hash) % 100;

  const enabledVariants = Object.values(AB_TEST_VARIANTS).filter(v => v.enabled);
  
  if (enabledVariants.length === 0) {
    return 'control';
  }

  let cumulativePercentage = 0;
  for (const variant of enabledVariants) {
    const percentage = variant.userPercentage || 0;
    cumulativePercentage += percentage;
    
    if (hashValue < cumulativePercentage) {
      return variant.variant;
    }
  }

  return 'control';
}

/**
 * Update A/B test configuration
 */
export function updateABTestConfig(
  variantKey: string,
  config: Partial<ABTestConfig>
): void {
  if (AB_TEST_VARIANTS[variantKey]) {
    AB_TEST_VARIANTS[variantKey] = {
      ...AB_TEST_VARIANTS[variantKey],
      ...config,
    };
  }
}

/**
 * Get all A/B test configurations
 */
export function getAllABTestConfigs(): Record<string, ABTestConfig> {
  return { ...AB_TEST_VARIANTS };
}

/**
 * Validate weights sum to 1.0
 */
export function validateWeights(weights: RankingWeights): boolean {
  const sum = Object.values(weights).reduce((acc, val) => acc + (val || 0), 0);
  return Math.abs(sum - 1.0) < 0.01; // Allow small floating point errors
}

