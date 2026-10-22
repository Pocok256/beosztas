/**
 * Scheduler tuning values resolved from defaults and request-level overrides.
 */
export type SchedulerConfigValues = {
  sameAssignmentBonus: number;
  sameAssignmentDecayStartStreak: number;
  sameAssignmentDecayPerDay: number;
  sameAssignmentMinimumBonus: number;
  partialContinuationBonus: number;
  fullBreakPenalty: number;
  primaryContinuationBonus: number;
  primaryDemotionPenalty: number;
  primaryAvailableButDroppedPenalty: number;
  samePairPrimaryLockBonus: number;
  samePairPrimarySwapPenalty: number;
  sameRoleLayoutBonus: number;
  swappedRoleLayoutPenalty: number;
  primaryRoleHourTolerance: number;
  roleGapHourDivisor: number;
  roleGapDayWeight: number;
  projectedPrimaryHourPenalty: number;
  projectedPrimaryDayPenalty: number;
  preservedRoleGapWeight: number;
  preservedPrimaryPenaltyWeight: number;
  maxHoursBonus: number;
  availabilityScarcityWeight: number;
  workStreakSoftLimit: number;
  workRestartPenalty: number;
  workContinuationBaseBonus: number;
  workContinuationGrowthBonus: number;
  workContinuationOverflowPenalty: number;
  totalHoursLeadGrace: number;
  totalHoursLeadPenalty: number;
  primaryHoursLeadGrace: number;
  primaryHoursLeadPenalty: number;
  futureAvailabilityMaxDays: number;
  futureAvailabilityBonusPerDay: number;
  fairTargetImprovementDivisor: number;
};

/**
 * Optional scheduler tuning overrides accepted from the UI or tests.
 */
export type SchedulerConfigOverride = Partial<SchedulerConfigValues>;

/**
 * Scheduler config field metadata used by the browser tuning form.
 */
export type SchedulerConfigField = {
  key: keyof SchedulerConfigValues;
  envName: string;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
};

/**
 * Scheduler config section metadata grouping the UI fields.
 */
export type SchedulerConfigSection = {
  id: string;
  title: string;
  description: string;
  fields: SchedulerConfigField[];
};

/**
 * Resolved scheduler configuration payload returned by the API.
 */
export type SchedulerConfigManifest = {
  values: SchedulerConfigValues;
  sections: SchedulerConfigSection[];
};