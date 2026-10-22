import type { SchedulerConfigValues } from "./SchedulerConfig";

/**
 * Color tokens assigned to a person across UI and exports.
 */
export type PersonColor = {
  accent: string;
  surface: string;
  border: string;
  text: string;
};

/**
 * Day-level override for workday or day-off handling.
 */
export type DayException = {
  dayNumber: number;
  type: "workday" | "dayoff";
  note?: string;
};

/**
 * Person input and output shape shared by the scheduler and UI.
 */
export type SchedulePerson = {
  id?: string;
  name: string;
  color?: PersonColor | null;
  unavailableDays: number[];
};

/**
 * Assignment role variants used in schedule output.
 */
export type AssignmentRole = "primary" | "secondary" | "solo";

/**
 * Single day assignment record in generated schedules.
 */
export type ScheduleAssignment = {
  personId: string;
  name: string;
  color: PersonColor | null;
  hours: number;
  role: AssignmentRole | "primary" | "secondary";
};

/**
 * Generated day information for a monthly schedule.
 */
export type ScheduleDay = {
  dayNumber: number;
  dateIso: string;
  weekdayIndex: number;
  weekdayLabel: string;
  holiday: boolean;
  holidayLabel: string | null;
  overrideLabel: string | null;
  overrideType: "workday" | "dayoff" | null;
  weekend: boolean;
  workFreeDay: boolean;
  requiredHours: number;
  assignments: ScheduleAssignment[];
};

/**
 * Summary metrics about a generated schedule.
 */
export type ScheduleSummary = {
  totalDays: number;
  overrideDays: number;
  overrideDayoffDays: number;
  overrideWorkdayDays: number;
  weekendDays: number;
  holidayDays: number;
  weekdayDays: number;
  workFreeDays: number;
  totalRequiredHours: number;
  minimumCoverageHours: number;
  maximumAssignableHours: number;
  targetTotalHours: number;
  targetScheduledHours: number;
  scheduledHours: number;
  averageRequiredHours: number;
  desiredTargetHours: number;
  feasibleForAll168: boolean;
  coveragePossibleWithinCap: boolean;
  theoreticalAverageHours: number;
  maxFeasibleAverageHours: number;
  scheduledAverageHours: number;
};

/**
 * Person-level summary emitted by the scheduler.
 */
export type PersonSummary = {
  id: string;
  name: string;
  color: PersonColor | null;
  totalHours: number;
  primaryHours: number;
  primary16Days: number;
  primary24Days: number;
  secondaryHours: number;
  secondary16Days: number;
  secondary24Days: number;
  soloHours: number;
  targetDelta: number;
  workedDays: number;
  primaryDays: number;
  secondaryDays: number;
  soloDays: number;
  splitDays: number;
  blocks: number;
  primaryBlocks: number;
  secondaryBlocks: number;
  longestStreak: number;
  longestPrimaryStreak: number;
  longestSecondaryStreak: number;
  roleBalanceDelta: number;
  unavailableDays: number[];
};

/**
 * Main generated schedule result before export metadata is attached.
 */
export type ScheduleResult = {
  month: string;
  monthLabel: string;
  summary: ScheduleSummary;
  people: SchedulePerson[];
  config: SchedulerConfigValues;
  exceptions: DayException[];
  days: ScheduleDay[];
  personSummaries: PersonSummary[];
  warnings: string[];
};

/**
 * Persisted schedule entry returned by the API and stored in history.
 */
export type ScheduleEntry = ScheduleResult & {
  id: string;
  createdAt: string;
  exportFileName?: string;
  exportPath?: string;
  xlsExportFileName?: string;
  xlsExportPath?: string;
};