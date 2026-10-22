import type { AssignmentRole, ScheduleAssignment, ScheduleDay } from "@shared/types/ScheduleEntry";

import { DESIRED_TARGET_HOURS } from "./SchedulerConstants";
import type {
  NormalizedPerson,
  PreviousRoleAssignments,
  ScheduleMonthParams,
  ScheduleMonthResult,
  ScoredCandidate,
  SchedulerCandidate,
  SchedulerMonthDay,
  SchedulerPersonState,
  ScoreCandidateContext
} from "./SchedulerTypes";

function deviationImprovement(currentHours: number, addedHours: number, targetHours: number): number {
  const before = currentHours - targetHours;
  const after = currentHours + addedHours - targetHours;
  return before * before - after * after;
}

function createPersonState(person: NormalizedPerson): SchedulerPersonState {
  return {
    ...person,
    hours: 0,
    workedDays: 0,
    currentWorkStreak: 0,
    lastWorkedDay: 0,
    primaryHours: 0,
    primaryDays: 0,
    currentPrimaryStreak: 0,
    lastPrimaryDay: 0,
    secondaryHours: 0,
    secondaryDays: 0,
    currentSecondaryStreak: 0,
    lastSecondaryDay: 0
  };
}

function buildCandidates(eligiblePeople: SchedulerPersonState[], requiredHours: number): SchedulerCandidate[] {
  if (eligiblePeople.length < 2) {
    return eligiblePeople.map((person) => ({
      members: [{ person, hours: requiredHours, role: "solo" }]
    }));
  }

  const candidates: SchedulerCandidate[] = [];

  for (let firstIndex = 0; firstIndex < eligiblePeople.length - 1; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < eligiblePeople.length; secondIndex += 1) {
      const firstPerson = eligiblePeople[firstIndex];
      const secondPerson = eligiblePeople[secondIndex];

      candidates.push({
        members: [
          { person: firstPerson, hours: requiredHours, role: "primary" },
          { person: secondPerson, hours: requiredHours, role: "secondary" }
        ]
      });
      candidates.push({
        members: [
          { person: secondPerson, hours: requiredHours, role: "primary" },
          { person: firstPerson, hours: requiredHours, role: "secondary" }
        ]
      });
    }
  }

  return candidates;
}

function getAvailabilityScarcityScore(
  person: SchedulerPersonState,
  daysInMonth: number,
  config: ScoreCandidateContext["config"]
): number {
  return ((daysInMonth - person.totalAvailableDays) / Math.max(1, daysInMonth)) * config.availabilityScarcityWeight;
}

function getWorkContinuationScore(
  person: SchedulerPersonState,
  dayNumber: number,
  config: ScoreCandidateContext["config"]
): number {
  if (person.lastWorkedDay !== dayNumber - 1) {
    return person.workedDays > 0 ? -config.workRestartPenalty : 0;
  }

  const streakDepth = Math.min(person.currentWorkStreak, config.workStreakSoftLimit);
  const streakOverflow = Math.max(0, person.currentWorkStreak - config.workStreakSoftLimit);
  return (
    config.workContinuationBaseBonus +
    streakDepth * config.workContinuationGrowthBonus -
    streakOverflow * config.workContinuationOverflowPenalty
  );
}

function getRoleGapImprovement(
  person: SchedulerPersonState,
  role: AssignmentRole,
  hours: number,
  config: ScoreCandidateContext["config"]
): number {
  const effectiveRole = role === "solo" ? "primary" : role;

  if (effectiveRole !== "primary" && effectiveRole !== "secondary") {
    return 0;
  }

  const beforeHourGap = person.primaryHours - person.secondaryHours;
  const afterHourGap = effectiveRole === "primary" ? beforeHourGap + hours : beforeHourGap - hours;
  const beforeDayGap = person.primaryDays - person.secondaryDays;
  const afterDayGap = effectiveRole === "primary" ? beforeDayGap + 1 : beforeDayGap - 1;

  return (
    (beforeHourGap * beforeHourGap - afterHourGap * afterHourGap) / config.roleGapHourDivisor +
    (beforeDayGap * beforeDayGap - afterDayGap * afterDayGap) * config.roleGapDayWeight
  );
}

function getFutureAvailabilityStreak(
  person: SchedulerPersonState,
  dayNumber: number,
  daysInMonth: number
): number {
  let streak = 0;

  for (let currentDay = dayNumber; currentDay <= daysInMonth; currentDay += 1) {
    if (person.unavailableSet.has(currentDay)) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function buildFutureAvailabilityHoursIndex(
  people: SchedulerPersonState[],
  days: SchedulerMonthDay[]
): Map<string, Map<number, number>> {
  return new Map(
    people.map((person) => {
      const futureHoursByDay = new Map<number, number>();
      let runningHours = 0;

      for (let dayIndex = days.length - 1; dayIndex >= 0; dayIndex -= 1) {
        const day = days[dayIndex];
        futureHoursByDay.set(day.dayNumber, runningHours);

        if (!person.unavailableSet.has(day.dayNumber)) {
          runningHours += day.requiredHours;
        }
      }

      return [person.id, futureHoursByDay];
    })
  );
}

function getCoverageDeficitImprovement(
  person: SchedulerPersonState,
  addedHours: number,
  futureAvailableHours: number,
  targetHours: number
): number {
  const beforeDeficit = Math.max(0, targetHours - person.hours - futureAvailableHours);
  const afterDeficit = Math.max(0, targetHours - person.hours - addedHours - futureAvailableHours);

  return beforeDeficit - afterDeficit;
}

function getProjectedPrimaryPenalty(
  person: SchedulerPersonState,
  role: AssignmentRole,
  hours: number,
  config: ScoreCandidateContext["config"]
): number {
  if (role !== "primary" && role !== "solo") {
    return 0;
  }

  const projectedPrimaryHours = person.primaryHours + hours;
  const projectedPrimaryDays = person.primaryDays + 1;
  const projectedWorkedDays = person.workedDays + 1;
  const allowedPrimaryDays = Math.ceil(projectedWorkedDays / 2);
  const hourOverage = Math.max(0, projectedPrimaryHours - person.secondaryHours - config.primaryRoleHourTolerance);
  const dayOverage = Math.max(0, projectedPrimaryDays - allowedPrimaryDays);

  return hourOverage * config.projectedPrimaryHourPenalty + dayOverage * config.projectedPrimaryDayPenalty;
}

function getCurrentPrimaryId(candidate: SchedulerCandidate): string | null {
  return candidate.members.find((member) => member.role === "primary" || member.role === "solo")?.person.id || null;
}

function scoreCandidate(candidate: SchedulerCandidate, context: ScoreCandidateContext): number {
  const config = context.config;
  const assignedIds = candidate.members.map((member) => member.person.id);
  const assignedSet = new Set(assignedIds);
  const overlapCount = context.previousAssignments.filter((personId) => assignedSet.has(personId)).length;
  const samePairAsPrevious =
    candidate.members.length === 2 && context.previousAssignments.length === 2 && overlapCount === 2;
  const sameSoloAsPrevious =
    candidate.members.length === 1 && context.previousAssignments.length === 1 && overlapCount === 1;
  const currentPrimaryId = getCurrentPrimaryId(candidate);
  const previousPrimaryId = context.previousRoleAssignments.primary || context.previousRoleAssignments.solo || null;
  const preservesCurrentPrimaryBlock = Boolean(previousPrimaryId) && currentPrimaryId === previousPrimaryId;
  const roleGapWeight = preservesCurrentPrimaryBlock ? config.preservedRoleGapWeight : 1;
  const primaryPenaltyWeight = preservesCurrentPrimaryBlock ? config.preservedPrimaryPenaltyWeight : 1;
  let score = 0;

  for (const member of candidate.members) {
    const futureAvailableHours = context.futureAvailabilityHoursByPersonId.get(member.person.id)?.get(context.dayNumber) || 0;
    const coverageDeficitImprovement = getCoverageDeficitImprovement(
      member.person,
      member.hours,
      futureAvailableHours,
      context.fairTarget
    );

    score += deviationImprovement(member.person.hours, member.hours, context.fairTarget) / config.fairTargetImprovementDivisor;
    score += getAvailabilityScarcityScore(member.person, context.daysInMonth, config);
    score += coverageDeficitImprovement * config.availabilityScarcityWeight;
    score += getWorkContinuationScore(member.person, context.dayNumber, config);
    score += getRoleGapImprovement(member.person, member.role, member.hours, config) * roleGapWeight;
    score -= getProjectedPrimaryPenalty(member.person, member.role, member.hours, config) * primaryPenaltyWeight;
    score -= Math.max(0, member.person.hours - context.lowestHours - config.totalHoursLeadGrace) * config.totalHoursLeadPenalty;

    if (member.role === "primary" || member.role === "solo") {
      score -= Math.max(0, member.person.primaryHours - context.lowestPrimaryHours - config.primaryHoursLeadGrace) * config.primaryHoursLeadPenalty;
      score +=
        Math.min(
          config.futureAvailabilityMaxDays,
          getFutureAvailabilityStreak(member.person, context.dayNumber, context.daysInMonth)
        ) * config.futureAvailabilityBonusPerDay;
    }

    if (member.person.hours + member.hours === DESIRED_TARGET_HOURS) {
      score += config.maxHoursBonus;
    }
  }

  if (samePairAsPrevious || sameSoloAsPrevious) {
    const blockDepth = Math.min(...candidate.members.map((member) => member.person.currentWorkStreak));
    const continuationBonus = Math.max(
      config.sameAssignmentMinimumBonus,
      config.sameAssignmentBonus -
        Math.max(0, blockDepth - config.sameAssignmentDecayStartStreak) * config.sameAssignmentDecayPerDay
    );
    score += continuationBonus;
  } else if (overlapCount > 0) {
    score += overlapCount * config.partialContinuationBonus;
  } else if (context.previousAssignments.length > 0) {
    score -= config.fullBreakPenalty;
  }

  if (previousPrimaryId) {
    const previousPrimaryIncluded = assignedSet.has(previousPrimaryId);

    if (previousPrimaryIncluded && currentPrimaryId === previousPrimaryId) {
      score += config.primaryContinuationBonus;
    } else if (previousPrimaryIncluded) {
      score -= config.primaryDemotionPenalty;
    } else if (context.previousPrimaryCanContinue) {
      score -= config.primaryAvailableButDroppedPenalty;
    }
  }

  if (samePairAsPrevious && candidate.members.length === 2) {
    const keepsRoles = candidate.members.every(
      (member) => context.previousRoleAssignments[member.role] === member.person.id
    );
    const swapsRoles = candidate.members.every((member) => {
      const oppositeRole = member.role === "primary" ? "secondary" : "primary";
      return context.previousRoleAssignments[oppositeRole] === member.person.id;
    });

    if (keepsRoles) {
      score += config.sameRoleLayoutBonus;
    }

    if (swapsRoles) {
      score -= config.swappedRoleLayoutPenalty;
    }

    if (currentPrimaryId === context.previousRoleAssignments.primary) {
      score += config.samePairPrimaryLockBonus;
    } else {
      score -= config.samePairPrimarySwapPenalty;
    }
  }

  return score;
}

function buildCandidateSignature(candidate: SchedulerCandidate): string {
  return candidate.members.map((member) => `${member.person.id}:${member.role}`).join("|");
}

function chooseCandidate(scoredCandidates: ScoredCandidate[]): SchedulerCandidate | null {
  scoredCandidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.signature.localeCompare(right.signature);
  });

  return scoredCandidates[0]?.candidate || null;
}

function updatePeopleForDay(
  people: SchedulerPersonState[],
  candidate: SchedulerCandidate,
  dayNumber: number
): void {
  const assignmentsByPersonId = new Map<string, SchedulerCandidate["members"][number]>(
    candidate.members.map((member) => [member.person.id, member])
  );

  for (const person of people) {
    const assignedMember = assignmentsByPersonId.get(person.id);
    const primaryToday = assignedMember ? assignedMember.role === "primary" || assignedMember.role === "solo" : false;
    const secondaryToday = assignedMember ? assignedMember.role === "secondary" : false;

    if (assignedMember) {
      person.currentWorkStreak = person.lastWorkedDay === dayNumber - 1 ? person.currentWorkStreak + 1 : 1;
      person.lastWorkedDay = dayNumber;
      person.workedDays += 1;
      person.hours += assignedMember.hours;
    } else if (person.lastWorkedDay === dayNumber - 1) {
      person.currentWorkStreak = 0;
    }

    if (primaryToday && assignedMember) {
      person.currentPrimaryStreak = person.lastPrimaryDay === dayNumber - 1 ? person.currentPrimaryStreak + 1 : 1;
      person.lastPrimaryDay = dayNumber;
      person.primaryHours += assignedMember.hours;
      person.primaryDays += 1;
    } else if (person.lastPrimaryDay === dayNumber - 1) {
      person.currentPrimaryStreak = 0;
    }

    if (secondaryToday && assignedMember) {
      person.currentSecondaryStreak =
        person.lastSecondaryDay === dayNumber - 1 ? person.currentSecondaryStreak + 1 : 1;
      person.lastSecondaryDay = dayNumber;
      person.secondaryHours += assignedMember.hours;
      person.secondaryDays += 1;
    } else if (person.lastSecondaryDay === dayNumber - 1) {
      person.currentSecondaryStreak = 0;
    }
  }
}

export function scheduleMonth({ config, fairTarget, minimumCoverageHours, monthInfo, people }: ScheduleMonthParams): ScheduleMonthResult {
  const personStates = people.map((person) => createPersonState(person));
  const futureAvailabilityHoursByPersonId = buildFutureAvailabilityHoursIndex(personStates, monthInfo.days);
  const days: ScheduleDay[] = [];
  const warnings: string[] = [];
  let totalAssignedHours = 0;
  let previousAssignments: string[] = [];
  let previousRoleAssignments: PreviousRoleAssignments = { primary: null, secondary: null, solo: null };
  let remainingMinimumHours = minimumCoverageHours;

  for (const day of monthInfo.days) {
    const availablePeople = personStates.filter((person) => !person.unavailableSet.has(day.dayNumber));
    const eligiblePeople = availablePeople.filter((person) => person.hours + day.requiredHours <= DESIRED_TARGET_HOURS);
    const remainingMinimumHoursAfterToday = remainingMinimumHours - day.requiredHours;

    if (availablePeople.length === 0) {
      warnings.push(`${day.dateIso}: nincs elerheto ember.`);
      days.push({
        ...day,
        assignments: []
      });
      previousAssignments = [];
      previousRoleAssignments = { primary: null, secondary: null, solo: null };
      remainingMinimumHours = remainingMinimumHoursAfterToday;
      continue;
    }

    if (eligiblePeople.length === 0) {
      warnings.push(
        `${day.dateIso}: nincs olyan elerheto ember, akinek meg beleferne a ${day.requiredHours} oras muszak a 168 oras plafonba.`
      );
      days.push({
        ...day,
        assignments: []
      });
      previousAssignments = [];
      previousRoleAssignments = { primary: null, secondary: null, solo: null };
      remainingMinimumHours = remainingMinimumHoursAfterToday;
      continue;
    }

    const scoredCandidates = buildCandidates(eligiblePeople, day.requiredHours).map((candidate) => ({
      candidate,
      score: scoreCandidate(candidate, {
        config,
        fairTarget,
        futureAvailabilityHoursByPersonId,
        dayNumber: day.dayNumber,
        daysInMonth: monthInfo.daysInMonth,
        lowestHours: Math.min(...personStates.map((person) => person.hours)),
        lowestPrimaryHours: Math.min(...personStates.map((person) => person.primaryHours)),
        previousAssignments,
        previousPrimaryCanContinue: eligiblePeople.some(
          (person) => person.id === (previousRoleAssignments.primary || previousRoleAssignments.solo)
        ),
        previousRoleAssignments
      }),
      signature: buildCandidateSignature(candidate)
    }));

    const chosenCandidate = chooseCandidate(scoredCandidates);

    if (!chosenCandidate) {
      warnings.push(`${day.dateIso}: nem sikerult ervenyes beosztast valasztani.`);
      days.push({
        ...day,
        assignments: []
      });
      previousAssignments = [];
      previousRoleAssignments = { primary: null, secondary: null, solo: null };
      remainingMinimumHours = remainingMinimumHoursAfterToday;
      continue;
    }

    updatePeopleForDay(personStates, chosenCandidate, day.dayNumber);

    const assignments: ScheduleAssignment[] = chosenCandidate.members.map((member) => ({
      personId: member.person.id,
      name: member.person.name,
      color: member.person.color,
      hours: member.hours,
      role: member.role
    }));

    days.push({
      ...day,
      assignments
    });

    totalAssignedHours += assignments.reduce((sum, assignment) => sum + assignment.hours, 0);
    previousAssignments = assignments.map((assignment) => assignment.personId);
    previousRoleAssignments = { primary: null, secondary: null, solo: null };

    for (const assignment of assignments) {
      previousRoleAssignments[assignment.role] = assignment.personId;
    }

    remainingMinimumHours = remainingMinimumHoursAfterToday;
  }

  return {
    days,
    totalAssignedHours,
    warnings
  };
}
