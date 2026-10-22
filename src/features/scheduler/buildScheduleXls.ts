import type { ScheduleEntry } from "@shared/types/ScheduleEntry";

import { buildScheduleXls as buildScheduleXlsInternal } from "./internal/SchedulerExporters";

/**
 * Builds the XLS-compatible spreadsheet export for a generated schedule entry.
 *
 * @param params - Generated schedule entry.
 * @returns XML spreadsheet document.
 */
export function buildScheduleXls(params: ScheduleEntry): string {
  return buildScheduleXlsInternal(params);
}