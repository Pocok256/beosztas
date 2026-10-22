import { z } from "zod";

import type { SchedulerConfigOverride } from "@shared/types/SchedulerConfig";

/**
 * Runtime schema for request-level scheduler override values.
 */
export const SchedulerConfigOverrideSchema = z
  .object({
    sameAssignmentBonus: z.number().optional(),
    sameAssignmentDecayStartStreak: z.number().optional(),
    sameAssignmentDecayPerDay: z.number().optional(),
    sameAssignmentMinimumBonus: z.number().optional(),
    partialContinuationBonus: z.number().optional(),
    fullBreakPenalty: z.number().optional(),
    primaryContinuationBonus: z.number().optional(),
    primaryDemotionPenalty: z.number().optional(),
    primaryAvailableButDroppedPenalty: z.number().optional(),
    samePairPrimaryLockBonus: z.number().optional(),
    samePairPrimarySwapPenalty: z.number().optional(),
    sameRoleLayoutBonus: z.number().optional(),
    swappedRoleLayoutPenalty: z.number().optional(),
    primaryRoleHourTolerance: z.number().optional(),
    roleGapHourDivisor: z.number().optional(),
    roleGapDayWeight: z.number().optional(),
    projectedPrimaryHourPenalty: z.number().optional(),
    projectedPrimaryDayPenalty: z.number().optional(),
    preservedRoleGapWeight: z.number().optional(),
    preservedPrimaryPenaltyWeight: z.number().optional(),
    maxHoursBonus: z.number().optional(),
    availabilityScarcityWeight: z.number().optional(),
    workStreakSoftLimit: z.number().optional(),
    workRestartPenalty: z.number().optional(),
    workContinuationBaseBonus: z.number().optional(),
    workContinuationGrowthBonus: z.number().optional(),
    workContinuationOverflowPenalty: z.number().optional(),
    totalHoursLeadGrace: z.number().optional(),
    totalHoursLeadPenalty: z.number().optional(),
    primaryHoursLeadGrace: z.number().optional(),
    primaryHoursLeadPenalty: z.number().optional(),
    futureAvailabilityMaxDays: z.number().optional(),
    futureAvailabilityBonusPerDay: z.number().optional(),
    fairTargetImprovementDivisor: z.number().optional()
  })
  .strict();

const SchedulerConfigOverrideSchemaExhaustiveCheck: z.infer<typeof SchedulerConfigOverrideSchema> =
  {} as SchedulerConfigOverride;
const SchedulerConfigOverrideSchemaReverseCheck: SchedulerConfigOverride = {} as z.infer<
  typeof SchedulerConfigOverrideSchema
>;

export {
  SchedulerConfigOverrideSchemaExhaustiveCheck,
  SchedulerConfigOverrideSchemaReverseCheck
};