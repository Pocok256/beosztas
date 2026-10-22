import type { AssignmentRole, ScheduleDay } from "@shared/types/ScheduleEntry";
import type { SchedulerConfigValues } from "@shared/types/SchedulerConfig";

import { buildPersonSummaries } from "./SchedulerSummary";
import type {
  AnomalyMetrics,
  BalanceMetrics,
  ScheduleQualityParams,
  SchedulerBlock,
  SchedulerRange
} from "./SchedulerTypes";

function getEffectiveAssignmentRole(role: AssignmentRole): AssignmentRole {
  return role === "solo" ? "primary" : role;
}

export function normalizeScheduledDays(days: ScheduleDay[]): ScheduleDay[] {
  return days.map((day) => ({
    ...day,
    assignments: day.assignments.map((assignment) => ({
      ...assignment,
      role: getEffectiveAssignmentRole(assignment.role)
    }))
  }));
}

function cloneScheduleDays(days: ScheduleDay[]): ScheduleDay[] {
  return days.map((day) => ({
    ...day,
    assignments: day.assignments.map((assignment) => ({ ...assignment }))
  }));
}

function getSwappablePairKey(day: ScheduleDay): string | null {
  if (!canSwapDayRoles(day)) {
    return null;
  }

  return day.assignments
    .map((assignment) => assignment.personId)
    .sort((left, right) => left.localeCompare(right))
    .join("|");
}

function canSwapDayRoles(day: ScheduleDay): boolean {
  return (
    day.assignments.length === 2 &&
    day.assignments.some((assignment) => assignment.role === "primary") &&
    day.assignments.some((assignment) => assignment.role === "secondary")
  );
}

function swapDayRoles(day: ScheduleDay): ScheduleDay {
  return {
    ...day,
    assignments: day.assignments.map((assignment) => {
      if (assignment.role === "primary") {
        return {
          ...assignment,
          role: "secondary"
        };
      }

      if (assignment.role === "secondary") {
        return {
          ...assignment,
          role: "primary"
        };
      }

      return {
        ...assignment
      };
    })
  };
}

export function swapRoleRange(days: ScheduleDay[], startIndex: number, endIndex: number): ScheduleDay[] {
  const swappedDays = cloneScheduleDays(days);

  for (let dayIndex = startIndex; dayIndex <= endIndex; dayIndex += 1) {
    swappedDays[dayIndex] = swapDayRoles(swappedDays[dayIndex]);
  }

  return swappedDays;
}

type AddUniqueSwapRangeParams = {
  ranges: SchedulerRange[];
  seenRanges: Set<string>;
  startIndex: number;
  endIndex: number;
};

function addUniqueSwapRange(params: AddUniqueSwapRangeParams): void {
  const { ranges, seenRanges, startIndex, endIndex } = params;
  const key = `${startIndex}:${endIndex}`;

  if (seenRanges.has(key)) {
    return;
  }

  seenRanges.add(key);
  ranges.push({ startIndex, endIndex });
}

export function buildRoleSwapRanges(
  days: ScheduleDay[],
  config: SchedulerConfigValues | null = null
): SchedulerRange[] {
  const ranges: SchedulerRange[] = [];
  const blocks: SchedulerBlock[] = [];
  const seenRanges = new Set<string>();

  for (let startIndex = 0; startIndex < days.length; startIndex += 1) {
    const pairKey = getSwappablePairKey(days[startIndex]);

    if (!pairKey) {
      continue;
    }

    let endIndex = startIndex;
    while (endIndex + 1 < days.length && getSwappablePairKey(days[endIndex + 1]) === pairKey) {
      endIndex += 1;
    }

    addUniqueSwapRange({ ranges, seenRanges, startIndex, endIndex });

    if (endIndex > startIndex) {
      for (let rangeEnd = startIndex; rangeEnd < endIndex; rangeEnd += 1) {
        addUniqueSwapRange({ ranges, seenRanges, startIndex, endIndex: rangeEnd });
      }

      for (let rangeStart = startIndex + 1; rangeStart <= endIndex; rangeStart += 1) {
        addUniqueSwapRange({ ranges, seenRanges, startIndex: rangeStart, endIndex });
      }
    }

    blocks.push({
      startIndex,
      endIndex,
      pairKey,
      personIds: pairKey.split("|")
    });

    startIndex = endIndex;
  }

  for (let blockIndex = 0; blockIndex < blocks.length - 1; blockIndex += 1) {
    const currentBlock = blocks[blockIndex];
    const nextBlock = blocks[blockIndex + 1];

    if (nextBlock.startIndex !== currentBlock.endIndex + 1) {
      continue;
    }

    const sharedPersonIds = currentBlock.personIds.filter((personId) => nextBlock.personIds.includes(personId));

    if (sharedPersonIds.length !== 1) {
      continue;
    }

    addUniqueSwapRange({ ranges, seenRanges, startIndex: currentBlock.startIndex, endIndex: nextBlock.endIndex });

    for (let rangeStart = currentBlock.startIndex; rangeStart <= currentBlock.endIndex; rangeStart += 1) {
      for (let rangeEnd = nextBlock.startIndex; rangeEnd <= nextBlock.endIndex; rangeEnd += 1) {
        addUniqueSwapRange({ ranges, seenRanges, startIndex: rangeStart, endIndex: rangeEnd });
      }
    }
  }

  return ranges;
}

export function evaluateScheduleQuality({ config, people, days }: ScheduleQualityParams): number {
  const normalizedDays = normalizeScheduledDays(days);
  const personSummaries = buildPersonSummaries(people, normalizedDays);
  const workedPeople = personSummaries.filter((person) => person.totalHours > 0);
  const zeroPrimaryPeople = workedPeople.filter((person) => person.primaryHours === 0);
  const continuityMissPenalty = Math.max(
    120,
    config.primaryContinuationBonus + Math.round(config.primaryDemotionPenalty / 2)
  );
  const partnerCarryPenalty = Math.max(
    240,
    config.samePairPrimarySwapPenalty + config.primaryDemotionPenalty
  );
  const partnerPreparationPenalty = Math.max(
    90,
    Math.round((config.primaryContinuationBonus + config.samePairPrimaryLockBonus) / 2)
  );
  const samePairSwapPenalty = Math.max(150, config.samePairPrimarySwapPenalty);
  const extraPrimaryBlockPenalty = Math.max(60, Math.round(config.samePairPrimaryLockBonus / 2));
  const hourImbalancePenaltyWeight = Math.max(1, config.projectedPrimaryHourPenalty);
  const dayImbalancePenaltyWeight = Math.max(1, config.projectedPrimaryDayPenalty);
  const primaryLeadPenaltyWeight = Math.max(0.5, config.primaryHoursLeadPenalty);
  const primaryAverageDeviationWeight = Math.max(0.4, config.primaryHoursLeadPenalty * 1.5);
  const zeroPrimaryPenalty = Math.max(400, config.samePairPrimarySwapPenalty + config.primaryDemotionPenalty);
  let penalty = 0;

  for (let dayIndex = 1; dayIndex < normalizedDays.length; dayIndex += 1) {
    const previousDay = normalizedDays[dayIndex - 1];
    const currentDay = normalizedDays[dayIndex];

    if (previousDay.assignments.length === 0 || currentDay.assignments.length === 0) {
      continue;
    }

    const previousPrimary = previousDay.assignments.find((assignment) => assignment.role === "primary") || null;
    const currentPrimary = currentDay.assignments.find((assignment) => assignment.role === "primary") || null;

    if (!previousPrimary || !currentPrimary) {
      continue;
    }

    const currentAssignedIds = new Set(currentDay.assignments.map((assignment) => assignment.personId));
    if (currentAssignedIds.has(previousPrimary.personId) && currentPrimary.personId !== previousPrimary.personId) {
      penalty += continuityMissPenalty;
    }

    if (previousDay.assignments.length === 2 && currentDay.assignments.length === 2) {
      const previousAssignedIds = new Set(previousDay.assignments.map((assignment) => assignment.personId));
      const overlapAssignments = currentDay.assignments.filter((assignment) => previousAssignedIds.has(assignment.personId));
      const samePair = currentDay.assignments.every((assignment) => previousAssignedIds.has(assignment.personId));

      if (samePair && currentPrimary.personId !== previousPrimary.personId) {
        penalty += samePairSwapPenalty;
      }

      if (overlapAssignments.length === 1) {
        const continuingWorkerId = overlapAssignments[0].personId;
        if (currentPrimary.personId !== continuingWorkerId) {
          penalty += partnerCarryPenalty;
        } else if (previousPrimary.personId !== continuingWorkerId) {
          penalty += partnerPreparationPenalty;
        }
      }
    }
  }

  const primaryHours = personSummaries.map((person) => person.primaryHours);
  const lowestPrimaryHours = primaryHours.length > 0 ? Math.min(...primaryHours) : 0;
  const averagePrimaryHours =
    primaryHours.length > 0 ? primaryHours.reduce((sum, value) => sum + value, 0) / primaryHours.length : 0;
  const primarySpread = primaryHours.length > 0 ? Math.max(...primaryHours) - Math.min(...primaryHours) : 0;
  penalty += primarySpread * primaryLeadPenaltyWeight;
  penalty += zeroPrimaryPeople.length * zeroPrimaryPenalty;
  penalty += zeroPrimaryPeople.reduce((sum, person) => sum + person.totalHours, 0) * 2;

  for (const person of personSummaries) {
    const roleHourOverage = Math.max(
      0,
      Math.abs(person.primaryHours - person.secondaryHours) - config.primaryRoleHourTolerance
    );
    const primaryDayOverage = Math.max(0, person.primaryDays - Math.ceil(person.workedDays / 2));
    const primaryLeadOverage = Math.max(
      0,
      person.primaryHours - lowestPrimaryHours - config.primaryHoursLeadGrace
    );

    penalty += roleHourOverage * hourImbalancePenaltyWeight;
    penalty += primaryDayOverage * dayImbalancePenaltyWeight;
    penalty += primaryLeadOverage * primaryLeadPenaltyWeight;
    penalty += Math.pow(person.primaryHours - averagePrimaryHours, 2) * primaryAverageDeviationWeight * 0.04;
    penalty += Math.max(0, person.primaryBlocks - 1) * extraPrimaryBlockPenalty;
    penalty += Math.abs(person.primaryHours - person.secondaryHours) * 0.2;
  }

  return penalty;
}

function analyzeScheduleAnomalies(days: ScheduleDay[]): AnomalyMetrics {
  const normalizedDays = normalizeScheduledDays(days);
  const metrics = {
    continuityMissCount: 0,
    samePairPrimarySwapCount: 0,
    partnerCarryMissCount: 0,
    handoffPreparationMissCount: 0
  };

  for (let dayIndex = 1; dayIndex < normalizedDays.length; dayIndex += 1) {
    const previousDay = normalizedDays[dayIndex - 1];
    const currentDay = normalizedDays[dayIndex];

    if (previousDay.assignments.length === 0 || currentDay.assignments.length === 0) {
      continue;
    }

    const previousPrimary = previousDay.assignments.find((assignment) => assignment.role === "primary") || null;
    const currentPrimary = currentDay.assignments.find((assignment) => assignment.role === "primary") || null;

    if (!previousPrimary || !currentPrimary) {
      continue;
    }

    const currentAssignedIds = new Set(currentDay.assignments.map((assignment) => assignment.personId));
    if (currentAssignedIds.has(previousPrimary.personId) && currentPrimary.personId !== previousPrimary.personId) {
      metrics.continuityMissCount += 1;
    }

    if (previousDay.assignments.length === 2 && currentDay.assignments.length === 2) {
      const previousAssignedIds = new Set(previousDay.assignments.map((assignment) => assignment.personId));
      const overlapAssignments = currentDay.assignments.filter((assignment) => previousAssignedIds.has(assignment.personId));
      const samePair = currentDay.assignments.every((assignment) => previousAssignedIds.has(assignment.personId));

      if (samePair && currentPrimary.personId !== previousPrimary.personId) {
        metrics.samePairPrimarySwapCount += 1;
      }

      if (overlapAssignments.length === 1) {
        const continuingWorkerId = overlapAssignments[0].personId;
        if (currentPrimary.personId !== continuingWorkerId) {
          metrics.partnerCarryMissCount += 1;
        } else if (previousPrimary.personId !== continuingWorkerId) {
          metrics.handoffPreparationMissCount += 1;
        }
      }
    }
  }

  return metrics;
}

function compareAnomalyMetrics(leftMetrics: AnomalyMetrics, rightMetrics: AnomalyMetrics): number {
  const orderedKeys: Array<keyof AnomalyMetrics> = [
    "continuityMissCount",
    "samePairPrimarySwapCount",
    "partnerCarryMissCount",
    "handoffPreparationMissCount"
  ];

  for (const key of orderedKeys) {
    if (leftMetrics[key] !== rightMetrics[key]) {
      return leftMetrics[key] - rightMetrics[key];
    }
  }

  return 0;
}

function hasWorseAnomalyMetrics(currentMetrics: AnomalyMetrics, candidateMetrics: AnomalyMetrics): boolean {
  return (
    candidateMetrics.continuityMissCount > currentMetrics.continuityMissCount ||
    candidateMetrics.samePairPrimarySwapCount > currentMetrics.samePairPrimarySwapCount ||
    candidateMetrics.partnerCarryMissCount > currentMetrics.partnerCarryMissCount ||
    candidateMetrics.handoffPreparationMissCount > currentMetrics.handoffPreparationMissCount
  );
}

function analyzeScheduleBalance({ people, days }: Pick<ScheduleQualityParams, "people" | "days">): BalanceMetrics {
  const normalizedDays = normalizeScheduledDays(days);
  const personSummaries = buildPersonSummaries(people, normalizedDays);
  const workedPeople = personSummaries.filter((person) => person.totalHours > 0);
  const peopleWithBothRoles = personSummaries.filter(
    (person) => person.primaryHours > 0 && person.secondaryHours > 0
  );
  const zeroPrimaryPeople = workedPeople.filter((person) => person.primaryHours === 0);
  const primaryHours = personSummaries.map((person) => person.primaryHours);

  return {
    zeroPrimaryCount: zeroPrimaryPeople.length,
    zeroPrimaryHours: zeroPrimaryPeople.reduce((sum, person) => sum + person.totalHours, 0),
    primarySpread: primaryHours.length > 0 ? Math.max(...primaryHours) - Math.min(...primaryHours) : 0,
    averageRoleDiff:
      peopleWithBothRoles.length > 0
        ? peopleWithBothRoles.reduce(
            (sum, person) => sum + Math.abs(person.primaryHours - person.secondaryHours),
            0
          ) / peopleWithBothRoles.length
        : 0
  };
}

function compareBalanceMetrics(leftBalance: BalanceMetrics, rightBalance: BalanceMetrics): number {
  if (leftBalance.zeroPrimaryCount !== rightBalance.zeroPrimaryCount) {
    return leftBalance.zeroPrimaryCount - rightBalance.zeroPrimaryCount;
  }

  if (leftBalance.zeroPrimaryHours !== rightBalance.zeroPrimaryHours) {
    return leftBalance.zeroPrimaryHours - rightBalance.zeroPrimaryHours;
  }

  if (leftBalance.primarySpread !== rightBalance.primarySpread) {
    return leftBalance.primarySpread - rightBalance.primarySpread;
  }

  if (leftBalance.averageRoleDiff !== rightBalance.averageRoleDiff) {
    return leftBalance.averageRoleDiff - rightBalance.averageRoleDiff;
  }

  return 0;
}

function hasWorseBalanceMetrics(currentBalance: BalanceMetrics, candidateBalance: BalanceMetrics): boolean {
  return (
    candidateBalance.zeroPrimaryCount > currentBalance.zeroPrimaryCount ||
    candidateBalance.zeroPrimaryHours > currentBalance.zeroPrimaryHours + 0.001 ||
    candidateBalance.primarySpread > currentBalance.primarySpread + 0.001 ||
    candidateBalance.averageRoleDiff > currentBalance.averageRoleDiff + 0.001
  );
}

function getRepairBalanceDeltaScore(
  currentBalance: BalanceMetrics,
  candidateBalance: BalanceMetrics,
  currentMetrics: AnomalyMetrics,
  candidateMetrics: AnomalyMetrics
): number {
  const spreadImprovement = currentBalance.primarySpread - candidateBalance.primarySpread;
  const averageRoleDiffImprovement = currentBalance.averageRoleDiff - candidateBalance.averageRoleDiff;
  const zeroPrimaryCountImprovement = currentBalance.zeroPrimaryCount - candidateBalance.zeroPrimaryCount;
  const zeroPrimaryHoursImprovement = currentBalance.zeroPrimaryHours - candidateBalance.zeroPrimaryHours;
  const continuityImprovement = currentMetrics.continuityMissCount - candidateMetrics.continuityMissCount;
  const samePairSwapImprovement = currentMetrics.samePairPrimarySwapCount - candidateMetrics.samePairPrimarySwapCount;
  const partnerCarryImprovement = currentMetrics.partnerCarryMissCount - candidateMetrics.partnerCarryMissCount;
  const handoffPreparationImprovement =
    currentMetrics.handoffPreparationMissCount - candidateMetrics.handoffPreparationMissCount;

  return (
    zeroPrimaryCountImprovement * 1000 +
    zeroPrimaryHoursImprovement * 12 +
    spreadImprovement * 6 +
    averageRoleDiffImprovement * 4 +
    continuityImprovement * 24 +
    samePairSwapImprovement * 18 +
    partnerCarryImprovement * 24 +
    handoffPreparationImprovement * 12
  );
}

function buildContinuityRepairRanges(days: ScheduleDay[]): SchedulerRange[] {
  const ranges: SchedulerRange[] = [];
  const seen = new Set<string>();
  const blocks: SchedulerBlock[] = [];

  for (let startIndex = 0; startIndex < days.length; startIndex += 1) {
    const pairKey = getSwappablePairKey(days[startIndex]);

    if (!pairKey) {
      continue;
    }

    let endIndex = startIndex;
    while (endIndex + 1 < days.length && getSwappablePairKey(days[endIndex + 1]) === pairKey) {
      endIndex += 1;
    }

    if (endIndex > startIndex) {
      for (let rangeEnd = startIndex; rangeEnd < endIndex; rangeEnd += 1) {
        const key = `${startIndex}:${rangeEnd}`;
        if (!seen.has(key)) {
          seen.add(key);
          ranges.push({ startIndex, endIndex: rangeEnd });
        }
      }

      for (let rangeStart = startIndex + 1; rangeStart <= endIndex; rangeStart += 1) {
        const key = `${rangeStart}:${endIndex}`;
        if (!seen.has(key)) {
          seen.add(key);
          ranges.push({ startIndex: rangeStart, endIndex });
        }
      }
    }

    blocks.push({
      startIndex,
      endIndex,
      pairKey,
      personIds: pairKey.split("|")
    });

    startIndex = endIndex;
  }

  for (let blockIndex = 1; blockIndex < blocks.length; blockIndex += 1) {
    const previousBlock = blocks[blockIndex - 1];
    const currentBlock = blocks[blockIndex];

    if (currentBlock.startIndex !== previousBlock.endIndex + 1) {
      continue;
    }

    const sharedPersonIds = currentBlock.personIds.filter((personId) => previousBlock.personIds.includes(personId));
    if (sharedPersonIds.length !== 1) {
      continue;
    }

    const currentPrimaryId =
      days[currentBlock.startIndex].assignments.find((assignment) => assignment.role === "primary")?.personId || null;

    if (currentPrimaryId === sharedPersonIds[0]) {
      continue;
    }

    const key = `${currentBlock.startIndex}:${currentBlock.endIndex}`;
    if (!seen.has(key)) {
      seen.add(key);
      ranges.push({ startIndex: currentBlock.startIndex, endIndex: currentBlock.endIndex });
    }
  }

  return ranges;
}

export function repairPrimaryContinuityDays({ config, people, days }: ScheduleQualityParams): ScheduleDay[] {
  const continuityCandidates = buildContinuityRepairRanges(days);

  if (continuityCandidates.length === 0) {
    return days;
  }

  let repairedDays = cloneScheduleDays(days);
  let currentMetrics = analyzeScheduleAnomalies(repairedDays);
  let currentBalance = analyzeScheduleBalance({ people, days: repairedDays });
  let currentScore = evaluateScheduleQuality({ config, people, days: repairedDays });
  const maxIterations = Math.max(1, repairedDays.length * 2);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let bestMetricDelta = 0;
    let bestBalanceDelta = 0;
    let bestCandidateScore = currentScore;
    let bestCandidateMetrics = currentMetrics;
    let bestCandidateBalance = currentBalance;
    let bestCandidateDays: ScheduleDay[] | null = null;

    for (const candidateRange of continuityCandidates) {
      const candidateDays = swapRoleRange(repairedDays, candidateRange.startIndex, candidateRange.endIndex);
      const candidateMetrics = analyzeScheduleAnomalies(candidateDays);
      const candidateBalance = analyzeScheduleBalance({ people, days: candidateDays });

      if (hasWorseAnomalyMetrics(currentMetrics, candidateMetrics) || hasWorseBalanceMetrics(currentBalance, candidateBalance)) {
        continue;
      }

      const metricDelta = compareAnomalyMetrics(currentMetrics, candidateMetrics);
      const balanceDelta = compareBalanceMetrics(currentBalance, candidateBalance);

      if (metricDelta <= 0 && balanceDelta <= 0) {
        continue;
      }

      const candidateScore = evaluateScheduleQuality({ config, people, days: candidateDays });

      if (
        metricDelta > bestMetricDelta ||
        (metricDelta === bestMetricDelta && balanceDelta > bestBalanceDelta) ||
        (metricDelta === bestMetricDelta && balanceDelta === bestBalanceDelta && candidateScore < bestCandidateScore)
      ) {
        bestMetricDelta = metricDelta;
        bestBalanceDelta = balanceDelta;
        bestCandidateScore = candidateScore;
        bestCandidateMetrics = candidateMetrics;
        bestCandidateBalance = candidateBalance;
        bestCandidateDays = candidateDays;
      }
    }

    if (!bestCandidateDays || (bestMetricDelta <= 0 && bestBalanceDelta <= 0)) {
      break;
    }

    repairedDays = bestCandidateDays;
    currentMetrics = bestCandidateMetrics;
    currentBalance = bestCandidateBalance;
    currentScore = bestCandidateScore;
  }

  return repairedDays;
}

export function repairScheduleDays({ config, people, days }: ScheduleQualityParams): ScheduleDay[] {
  const swapCandidates = buildRoleSwapRanges(days, config);

  if (swapCandidates.length === 0) {
    return days;
  }

  let repairedDays = cloneScheduleDays(days);
  let currentScore = evaluateScheduleQuality({ config, people, days: repairedDays });
  let currentMetrics = analyzeScheduleAnomalies(repairedDays);
  let currentBalance = analyzeScheduleBalance({ people, days: repairedDays });
  const maxIterations = Math.max(1, repairedDays.length * 2);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let bestRepairDelta = 0;
    let bestCandidateScore = currentScore;
    let bestCandidateMetrics = currentMetrics;
    let bestCandidateBalance = currentBalance;
    let bestCandidateDays: ScheduleDay[] | null = null;

    for (const swapCandidate of swapCandidates) {
      const candidateDays = swapRoleRange(repairedDays, swapCandidate.startIndex, swapCandidate.endIndex);
      const candidateMetrics = analyzeScheduleAnomalies(candidateDays);
      const candidateBalance = analyzeScheduleBalance({ people, days: candidateDays });

      if (
        candidateBalance.zeroPrimaryCount > currentBalance.zeroPrimaryCount ||
        candidateBalance.zeroPrimaryHours > currentBalance.zeroPrimaryHours + 0.001 ||
        candidateMetrics.partnerCarryMissCount > currentMetrics.partnerCarryMissCount ||
        candidateMetrics.handoffPreparationMissCount > currentMetrics.handoffPreparationMissCount
      ) {
        continue;
      }

      const candidateScore = evaluateScheduleQuality({ config, people, days: candidateDays });
      const repairDelta = getRepairBalanceDeltaScore(currentBalance, candidateBalance, currentMetrics, candidateMetrics);

      if (
        repairDelta > bestRepairDelta + 0.001 ||
        (Math.abs(repairDelta - bestRepairDelta) <= 0.001 && candidateScore < bestCandidateScore)
      ) {
        bestRepairDelta = repairDelta;
        bestCandidateScore = candidateScore;
        bestCandidateMetrics = candidateMetrics;
        bestCandidateBalance = candidateBalance;
        bestCandidateDays = candidateDays;
      }
    }

    if (!bestCandidateDays || bestRepairDelta <= 0.001) {
      break;
    }

    repairedDays = bestCandidateDays;
    currentScore = bestCandidateScore;
    currentMetrics = bestCandidateMetrics;
    currentBalance = bestCandidateBalance;
  }

  return repairedDays;
}
