import type { GenerateScheduleInput } from "@shared/types/GenerateScheduleInput";
import type { ScheduleResult } from "@shared/types/ScheduleEntry";

import { buildSchedule as buildScheduleInternal } from "./internal/SchedulerCore";

/**
 * Builds a full monthly schedule from the validated input payload.
 *
 * @param params - Schedule generation input.
 * @returns Generated monthly schedule result.
 */
export function buildSchedule(params: GenerateScheduleInput): ScheduleResult {
  return buildScheduleInternal(params);
}