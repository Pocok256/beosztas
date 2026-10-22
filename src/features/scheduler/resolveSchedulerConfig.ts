import type { SchedulerConfigValues, SchedulerConfigOverride } from "@shared/types/SchedulerConfig";

import { resolveSchedulerConfig as resolveSchedulerConfigInternal } from "./internal/SchedulerConfig";

/**
 * Resolves the scheduler configuration from environment defaults and request-level overrides.
 *
 * @param params - Optional scheduler override object.
 * @returns Resolved scheduler configuration values.
 */
export function resolveSchedulerConfig(params?: SchedulerConfigOverride): SchedulerConfigValues {
  return resolveSchedulerConfigInternal(params ?? {}) as SchedulerConfigValues;
}