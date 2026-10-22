import type { ScheduleEntry } from "@shared/types/ScheduleEntry";

import { buildScheduleHtml as buildScheduleHtmlInternal } from "./internal/SchedulerExporters";

/**
 * Builds the HTML export markup for a generated schedule entry.
 *
 * @param params - Generated schedule entry.
 * @returns Standalone HTML document.
 */
export function buildScheduleHtml(params: ScheduleEntry): string {
  return buildScheduleHtmlInternal(params);
}