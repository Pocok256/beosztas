import type { SchedulerConfigManifest } from "@shared/types/SchedulerConfig";

import { getSchedulerConfigManifest as getSchedulerConfigManifestInternal } from "./internal/SchedulerConfig";

/**
 * Returns the resolved scheduler configuration together with the UI manifest metadata.
 *
 * @returns Scheduler configuration manifest.
 */
export function getSchedulerConfigManifest(): SchedulerConfigManifest {
  return getSchedulerConfigManifestInternal();
}