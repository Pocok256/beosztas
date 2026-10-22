import type { AssignmentRole, DayException, PersonColor, ScheduleDay } from "@shared/types/ScheduleEntry";
import type { SchedulerConfigValues } from "@shared/types/SchedulerConfig";

export type SchedulerCandidateMember = {
  person: SchedulerPersonState;
  hours: number;
  role: AssignmentRole;
};

export type SchedulerCandidate = {
  members: SchedulerCandidateMember[];
};

export type SchedulerRange = {
  startIndex: number;
  endIndex: number;
};

export type SchedulerBlock = SchedulerRange & {
  pairKey: string;
  personIds: string[];
};

export type SchedulerMonthDay = Omit<ScheduleDay, "assignments">;

export type SchedulerMonthInfo = {
  year: number;
  month: number;
  daysInMonth: number;
  exceptions: DayException[];
  monthKey: string;
  monthLabel: string;
  days: SchedulerMonthDay[];
};

export type NormalizedPerson = {
  id: string;
  name: string;
  color: PersonColor | null;
  unavailableDays: number[];
  unavailableSet: Set<number>;
  totalAvailableDays: number;
};

export type SchedulerPersonState = NormalizedPerson & {
  hours: number;
  workedDays: number;
  currentWorkStreak: number;
  lastWorkedDay: number;
  primaryHours: number;
  primaryDays: number;
  currentPrimaryStreak: number;
  lastPrimaryDay: number;
  secondaryHours: number;
  secondaryDays: number;
  currentSecondaryStreak: number;
  lastSecondaryDay: number;
};

export type PreviousRoleAssignments = Record<AssignmentRole, string | null>;

export type ScoredCandidate = {
  candidate: SchedulerCandidate;
  score: number;
  signature: string;
};

export type ScheduleMonthParams = {
  config: SchedulerConfigValues;
  fairTarget: number;
  minimumCoverageHours: number;
  monthInfo: SchedulerMonthInfo;
  people: NormalizedPerson[];
};

export type ScheduleMonthResult = {
  days: ScheduleDay[];
  totalAssignedHours: number;
  warnings: string[];
};

export type ScoreCandidateContext = {
  config: SchedulerConfigValues;
  fairTarget: number;
  futureAvailabilityHoursByPersonId: Map<string, Map<number, number>>;
  dayNumber: number;
  daysInMonth: number;
  lowestHours: number;
  lowestPrimaryHours: number;
  previousAssignments: string[];
  previousPrimaryCanContinue: boolean;
  previousRoleAssignments: PreviousRoleAssignments;
};

export type AnomalyMetrics = {
  continuityMissCount: number;
  samePairPrimarySwapCount: number;
  partnerCarryMissCount: number;
  handoffPreparationMissCount: number;
};

export type BalanceMetrics = {
  zeroPrimaryCount: number;
  zeroPrimaryHours: number;
  primarySpread: number;
  averageRoleDiff: number;
};

export type ScheduleQualityParams = {
  config: SchedulerConfigValues;
  people: NormalizedPerson[];
  days: ScheduleDay[];
};

export type PersonSummaryAccumulator = {
  id: string;
  name: string;
  color: PersonColor | null;
  unavailableDays: number[];
  totalHours: number;
  primaryHours: number;
  primary16Days: number;
  primary24Days: number;
  secondaryHours: number;
  secondary16Days: number;
  secondary24Days: number;
  workedDays: number;
  primaryDays: number;
  secondaryDays: number;
  splitDays: number;
  blocks: number;
  primaryBlocks: number;
  secondaryBlocks: number;
  longestStreak: number;
  longestPrimaryStreak: number;
  longestSecondaryStreak: number;
  currentWorkStreak: number;
  currentPrimaryStreak: number;
  currentSecondaryStreak: number;
  lastWorkedDay: number;
  lastPrimaryDay: number;
  lastSecondaryDay: number;
};
