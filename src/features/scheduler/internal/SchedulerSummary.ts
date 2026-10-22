import type { PersonSummary, ScheduleDay } from "@shared/types/ScheduleEntry";

import { DESIRED_TARGET_HOURS } from "./SchedulerConstants";
import type { NormalizedPerson, PersonSummaryAccumulator } from "./SchedulerTypes";

export function buildPersonSummaries(people: NormalizedPerson[], days: ScheduleDay[]): PersonSummary[] {
  const summaryByPersonId = new Map<string, PersonSummaryAccumulator>(
    people.map((person) => [
      person.id,
      {
        id: person.id,
        name: person.name,
        color: person.color,
        unavailableDays: person.unavailableDays,
        totalHours: 0,
        primaryHours: 0,
        primary16Days: 0,
        primary24Days: 0,
        secondaryHours: 0,
        secondary16Days: 0,
        secondary24Days: 0,
        workedDays: 0,
        primaryDays: 0,
        secondaryDays: 0,
        splitDays: 0,
        blocks: 0,
        primaryBlocks: 0,
        secondaryBlocks: 0,
        longestStreak: 0,
        longestPrimaryStreak: 0,
        longestSecondaryStreak: 0,
        currentWorkStreak: 0,
        currentPrimaryStreak: 0,
        currentSecondaryStreak: 0,
        lastWorkedDay: 0,
        lastPrimaryDay: 0,
        lastSecondaryDay: 0
      }
    ])
  );

  for (const day of days) {
    const splitDay = day.assignments.length === 2;

    for (const assignment of day.assignments) {
      const summary = summaryByPersonId.get(assignment.personId);

      if (!summary) {
        continue;
      }

      summary.totalHours += assignment.hours;
      summary.workedDays += 1;
      summary.currentWorkStreak = summary.lastWorkedDay === day.dayNumber - 1 ? summary.currentWorkStreak + 1 : 1;
      summary.lastWorkedDay = day.dayNumber;
      summary.longestStreak = Math.max(summary.longestStreak, summary.currentWorkStreak);

      if (summary.currentWorkStreak === 1) {
        summary.blocks += 1;
      }

      if (splitDay) {
        summary.splitDays += 1;
      }

      if (assignment.role === "primary") {
        summary.primaryHours += assignment.hours;
        summary.primaryDays += 1;
        if (assignment.hours === 16) {
          summary.primary16Days += 1;
        }
        if (assignment.hours === 24) {
          summary.primary24Days += 1;
        }

        summary.currentPrimaryStreak =
          summary.lastPrimaryDay === day.dayNumber - 1 ? summary.currentPrimaryStreak + 1 : 1;
        summary.lastPrimaryDay = day.dayNumber;
        summary.longestPrimaryStreak = Math.max(summary.longestPrimaryStreak, summary.currentPrimaryStreak);

        if (summary.currentPrimaryStreak === 1) {
          summary.primaryBlocks += 1;
        }
      }

      if (assignment.role === "secondary") {
        summary.secondaryHours += assignment.hours;
        summary.secondaryDays += 1;
        if (assignment.hours === 16) {
          summary.secondary16Days += 1;
        }
        if (assignment.hours === 24) {
          summary.secondary24Days += 1;
        }

        summary.currentSecondaryStreak =
          summary.lastSecondaryDay === day.dayNumber - 1 ? summary.currentSecondaryStreak + 1 : 1;
        summary.lastSecondaryDay = day.dayNumber;
        summary.longestSecondaryStreak = Math.max(
          summary.longestSecondaryStreak,
          summary.currentSecondaryStreak
        );

        if (summary.currentSecondaryStreak === 1) {
          summary.secondaryBlocks += 1;
        }
      }
    }
  }

  return Array.from(summaryByPersonId.values()).map((summary) => ({
    id: summary.id,
    name: summary.name,
    color: summary.color,
    totalHours: summary.totalHours,
    primaryHours: summary.primaryHours,
    primary16Days: summary.primary16Days,
    primary24Days: summary.primary24Days,
    secondaryHours: summary.secondaryHours,
    secondary16Days: summary.secondary16Days,
    secondary24Days: summary.secondary24Days,
    soloHours: 0,
    targetDelta: summary.totalHours - DESIRED_TARGET_HOURS,
    workedDays: summary.workedDays,
    primaryDays: summary.primaryDays,
    secondaryDays: summary.secondaryDays,
    soloDays: 0,
    splitDays: summary.splitDays,
    blocks: summary.blocks,
    primaryBlocks: summary.primaryBlocks,
    secondaryBlocks: summary.secondaryBlocks,
    longestStreak: summary.longestStreak,
    longestPrimaryStreak: summary.longestPrimaryStreak,
    longestSecondaryStreak: summary.longestSecondaryStreak,
    roleBalanceDelta: summary.primaryHours - summary.secondaryHours,
    unavailableDays: summary.unavailableDays
  }));
}
