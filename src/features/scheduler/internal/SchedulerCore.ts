import type { GenerateScheduleInput } from "@shared/types/GenerateScheduleInput";
import type { ScheduleResult } from "@shared/types/ScheduleEntry";

import { cloneSchedulerConfig, resolveSchedulerConfig } from "./SchedulerConfig";
import { DESIRED_TARGET_HOURS } from "./SchedulerConstants";
import { buildMonthInfo, normalizePeople, parseGenerateScheduleInput } from "./SchedulerInput";
import { scheduleMonth } from "./SchedulerPlanner";
import {
  buildRoleSwapRanges,
  evaluateScheduleQuality,
  normalizeScheduledDays,
  repairPrimaryContinuityDays,
  repairScheduleDays,
  swapRoleRange
} from "./SchedulerRepair";
import { buildPersonColor } from "./SchedulerShared";
import { buildPersonSummaries } from "./SchedulerSummary";

export { DESIRED_TARGET_HOURS };

function buildFeasibilityWarnings(params: {
  coveragePossibleWithinCap: boolean;
  desiredTarget: number;
  feasibleAverage: number;
  feasibleForAll168: boolean;
  maximumAssignableHours: number;
  minimumCoverageHours: number;
  normalizedPeopleCount: number;
  scheduledAssignedHours: number;
  targetScheduledHours: number;
  targetTotalHours: number;
}): string[] {
  const warnings: string[] = [];

  if (!params.feasibleForAll168) {
    warnings.push(
      `Ebben a honapban napi legfeljebb 2 emberrel osszesen ${params.maximumAssignableHours} ora oszthato ki. ${params.normalizedPeopleCount} embernek igy nem lehet fejenkent 168 orat adni, az elmeleti plafon ${Math.min(params.desiredTarget, params.feasibleAverage).toFixed(1)} ora / fo.`
    );
  }

  if (!params.coveragePossibleWithinCap) {
    warnings.push(
      `Ha minden napra legalabb 1 embert osztunk, ahhoz ${params.minimumCoverageHours} ora kellene, de ${params.normalizedPeopleCount} embernel a 168 oras plafon osszesen ${params.targetTotalHours} orat enged. Emiatt maradhatnak ures napok.`
    );
  }

  if (params.scheduledAssignedHours < params.targetScheduledHours) {
    warnings.push(
      `A megadott kizart napokkal es a 168 oras plafonnal vegul ${params.scheduledAssignedHours} ora lett kiosztva a celzott ${params.targetScheduledHours} ora helyett.`
    );
  }

  return warnings;
}

/**
 * Builds a complete schedule result from validated generation input.
 *
 * @param input - Raw schedule generation input.
 * @returns Generated schedule with summary, days, people and warnings.
 */
export function buildSchedule(input: GenerateScheduleInput): ScheduleResult {
  const parsedInput = parseGenerateScheduleInput(input);
  const schedulerConfig = resolveSchedulerConfig(parsedInput.config, { overrideStatusCode: 400 });
  const monthInfo = buildMonthInfo(parsedInput.month, parsedInput.exceptions);
  const normalizedPeople = normalizePeople(parsedInput.people, monthInfo.daysInMonth).map((person, index) => ({
    ...person,
    color: buildPersonColor(index)
  }));
  const minimumCoverageHours = monthInfo.days.reduce((sum, day) => sum + day.requiredHours, 0);
  const maximumAssignableHours = minimumCoverageHours * 2;
  const desiredTarget = DESIRED_TARGET_HOURS;
  const targetTotalHours = normalizedPeople.length * desiredTarget;
  const targetScheduledHours = Math.min(targetTotalHours, maximumAssignableHours);
  const feasibleAverage = maximumAssignableHours / normalizedPeople.length;
  const fairTarget = Math.min(desiredTarget, targetScheduledHours / normalizedPeople.length);
  const feasibleForAll168 = maximumAssignableHours >= targetTotalHours;
  const coveragePossibleWithinCap = minimumCoverageHours <= targetTotalHours;
  const scheduled = scheduleMonth({
    config: schedulerConfig,
    fairTarget,
    minimumCoverageHours,
    monthInfo,
    people: normalizedPeople
  });
  const continuityRepairedDays = repairPrimaryContinuityDays({
    config: schedulerConfig,
    people: normalizedPeople,
    days: scheduled.days
  });
  const repairedDays = repairScheduleDays({
    config: schedulerConfig,
    people: normalizedPeople,
    days: continuityRepairedDays
  });
  const normalizedDays = normalizeScheduledDays(repairedDays);
  const warnings = [
    ...buildFeasibilityWarnings({
      coveragePossibleWithinCap,
      desiredTarget,
      feasibleAverage,
      feasibleForAll168,
      maximumAssignableHours,
      minimumCoverageHours,
      normalizedPeopleCount: normalizedPeople.length,
      scheduledAssignedHours: scheduled.totalAssignedHours,
      targetScheduledHours,
      targetTotalHours
    }),
    ...scheduled.warnings
  ];

  return {
    month: monthInfo.monthKey,
    monthLabel: monthInfo.monthLabel,
    summary: {
      totalDays: monthInfo.daysInMonth,
      overrideDays: monthInfo.days.filter((day) => Boolean(day.overrideType)).length,
      overrideDayoffDays: monthInfo.days.filter((day) => day.overrideType === "dayoff").length,
      overrideWorkdayDays: monthInfo.days.filter((day) => day.overrideType === "workday").length,
      weekendDays: monthInfo.days.filter((day) => day.weekend).length,
      holidayDays: monthInfo.days.filter((day) => day.holiday).length,
      weekdayDays: monthInfo.days.filter((day) => !day.workFreeDay).length,
      workFreeDays: monthInfo.days.filter((day) => day.workFreeDay).length,
      totalRequiredHours: minimumCoverageHours,
      minimumCoverageHours,
      maximumAssignableHours,
      targetTotalHours,
      targetScheduledHours,
      scheduledHours: scheduled.totalAssignedHours,
      averageRequiredHours: Number(feasibleAverage.toFixed(1)),
      desiredTargetHours: desiredTarget,
      feasibleForAll168,
      coveragePossibleWithinCap,
      theoreticalAverageHours: Number(feasibleAverage.toFixed(1)),
      maxFeasibleAverageHours: Number(Math.min(desiredTarget, feasibleAverage).toFixed(1)),
      scheduledAverageHours: Number((scheduled.totalAssignedHours / normalizedPeople.length).toFixed(1))
    },
    people: normalizedPeople.map((person) => ({
      id: person.id,
      name: person.name,
      color: person.color,
      unavailableDays: person.unavailableDays
    })),
    config: cloneSchedulerConfig(schedulerConfig),
    exceptions: monthInfo.exceptions,
    days: normalizedDays,
    personSummaries: buildPersonSummaries(normalizedPeople, normalizedDays),
    warnings
  };
}

export const __private = {
  buildRoleSwapRanges,
  evaluateScheduleQuality,
  repairPrimaryContinuityDays,
  repairScheduleDays,
  scheduleMonth,
  swapRoleRange
};
