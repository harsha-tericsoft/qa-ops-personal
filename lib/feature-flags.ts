// Feature flags for controlling new functionality rollout

export const featureFlags = {
  // Filter-based suite creation and test case filtering
  enableFilterBasedSuites: process.env.ENABLE_FILTER_BASED_SUITES === 'true',
}

// Guard function to wrap new feature endpoints
export function requireFeatureFlag(flag: keyof typeof featureFlags) {
  return featureFlags[flag]
}
