import type { DayException, SchedulePerson } from "./ScheduleEntry";
import type { SchedulerConfigOverride } from "./SchedulerConfig";

/**
 * Input payload accepted by the monthly schedule generator.
 */
export type GenerateScheduleInput = {
  month: string;
  people: SchedulePerson[];
  exceptions?: DayException[] | null;
  config?: SchedulerConfigOverride;
};