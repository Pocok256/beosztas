const Holidays = require("date-holidays");

const DESIRED_TARGET_HOURS = 168;
const MAX_ATTEMPTS = 360;

const MONTH_NAMES = [
  "januar",
  "februar",
  "marcius",
  "aprilis",
  "majus",
  "junius",
  "julius",
  "augusztus",
  "szeptember",
  "oktober",
  "november",
  "december"
];

const WEEKDAY_NAMES = ["Vasarnap", "Hetfo", "Kedd", "Szerda", "Csutortok", "Pentek", "Szombat"];

function buildPersonColor(index) {
  const hue = (index * 67 + 18) % 360;

  return {
    accent: `hsl(${hue} 64% 44%)`,
    surface: `hsl(${hue} 68% 95%)`,
    border: `hsl(${hue} 52% 74%)`,
    text: `hsl(${hue} 40% 24%)`
  };
}

function buildPersonColorVariables(color) {
  if (!color) {
    return "";
  }

  return [
    `--person-accent:${color.accent}`,
    `--person-surface:${color.surface}`,
    `--person-border:${color.border}`,
    `--person-text:${color.text}`
  ].join(";");
}

function getScheduleTypeLabel(day) {
  if (day.overrideType === "workday") {
    return "Kiveteles munkanap";
  }

  if (day.overrideType === "dayoff") {
    return "Kiveteles szunnap";
  }

  if (day.holiday && day.weekend) {
    return "Hetvege es unnepnap";
  }

  if (day.holiday) {
    return "Unnepnap";
  }

  return day.weekend ? "Hetvege" : "Hetkoznap";
}

function escapeCsvCell(value) {
  const normalized = value == null ? "" : String(value);

  if (/[;"\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeDayExceptions(dayExceptions, daysInMonth) {
  if (dayExceptions == null) {
    return [];
  }

  if (!Array.isArray(dayExceptions)) {
    throw createValidationError("A kivetelek listaja hibas.");
  }

  const seenDays = new Set();

  return dayExceptions.map((dayException, index) => {
    const dayNumber = Number(dayException?.dayNumber);
    const type = typeof dayException?.type === "string" ? dayException.type.trim() : "";
    const note = typeof dayException?.note === "string" ? dayException.note.trim() : "";

    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > daysInMonth) {
      throw createValidationError(`A(z) ${index + 1}. kivetel napja hibas.`);
    }

    if (type !== "workday" && type !== "dayoff") {
      throw createValidationError(`A(z) ${index + 1}. kivetel tipusa hibas.`);
    }

    if (seenDays.has(dayNumber)) {
      throw createValidationError(`A ${dayNumber}. naphoz csak egy kivetel adható meg.`);
    }

    seenDays.add(dayNumber);

    return {
      dayNumber,
      type,
      note: note.slice(0, 120)
    };
  });
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function getHungarianHolidayProvider() {
  return new Holidays("HU");
}

function getPublicHolidayInfo(holidayProvider, date) {
  const holidayResult = holidayProvider.isHoliday(date);
  const holidayList = Array.isArray(holidayResult)
    ? holidayResult
    : holidayResult
      ? [holidayResult]
      : [];
  const publicHoliday = holidayList.find((holiday) => holiday.type === "public");

  if (!publicHoliday) {
    return null;
  }

  return {
    localName: publicHoliday.name,
    englishName: publicHoliday.name
  };
}

function hashString(input) {
  let hash = 1779033703 ^ input.length;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return hash >>> 0;
}

function mulberry32(seed) {
  return function nextRandom() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function parseMonth(monthKey) {
  if (typeof monthKey !== "string" || !/^\d{4}-\d{2}$/.test(monthKey)) {
    throw createValidationError("Adj meg egy ervenyes honapot, peldaul 2026-05.");
  }

  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw createValidationError("A honap formatuma hibas.");
  }

  return { year, month };
}

function buildMonthInfo(monthKey, dayExceptions = []) {
  const { year, month } = parseMonth(monthKey);
  const daysInMonth = new Date(year, month, 0).getDate();
  const holidayProvider = getHungarianHolidayProvider();
  const normalizedExceptions = normalizeDayExceptions(dayExceptions, daysInMonth);
  const exceptionMap = new Map(normalizedExceptions.map((dayException) => [dayException.dayNumber, dayException]));
  const days = [];

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    const date = new Date(year, month - 1, dayNumber);
    const weekdayIndex = date.getDay();
    const weekend = weekdayIndex === 0 || weekdayIndex === 6;
    const holidayInfo = getPublicHolidayInfo(holidayProvider, date);
    const dayException = exceptionMap.get(dayNumber) || null;
    const holiday = Boolean(holidayInfo);
    let workFreeDay = weekend || holiday;
    let requiredHours = workFreeDay ? 24 : 16;
    let overrideType = null;
    let overrideLabel = null;

    if (dayException) {
      overrideType = dayException.type;
      overrideLabel =
        dayException.note ||
        (dayException.type === "workday" ? "Kezileg munkanapra allitva" : "Kezileg szunnapra allitva");
      workFreeDay = dayException.type === "dayoff";
      requiredHours = workFreeDay ? 24 : 16;
    }

    days.push({
      dayNumber,
      dateIso: `${year}-${pad(month)}-${pad(dayNumber)}`,
      weekdayIndex,
      weekdayLabel: WEEKDAY_NAMES[weekdayIndex],
      holiday,
      holidayLabel: holidayInfo?.localName || null,
      overrideLabel,
      overrideType,
      weekend,
      workFreeDay,
      requiredHours
    });
  }

  return {
    year,
    month,
    daysInMonth,
    exceptions: normalizedExceptions,
    monthKey,
    monthLabel: `${year}. ${MONTH_NAMES[month - 1]}`,
    days
  };
}

function normalizePeople(people, daysInMonth) {
  if (!Array.isArray(people) || people.length === 0) {
    throw createValidationError("Adj meg legalabb egy embert a beosztashoz.");
  }

  const seenNames = new Set();

  return people.map((person, index) => {
    const rawName = typeof person?.name === "string" ? person.name.trim() : "";

    if (!rawName) {
      throw createValidationError(`A(z) ${index + 1}. ember neve hianyzik.`);
    }

    if (rawName.length > 60) {
      throw createValidationError(`A(z) ${rawName} nev tul hosszu.`);
    }

    const normalizedName = rawName.replace(/\s+/g, " ");
    const uniqueKey = normalizedName.toLocaleLowerCase("hu-HU");

    if (seenNames.has(uniqueKey)) {
      throw createValidationError(`A(z) ${normalizedName} nev tobbszor szerepel.`);
    }

    seenNames.add(uniqueKey);

    const unavailableDays = Array.isArray(person?.unavailableDays) ? person.unavailableDays : [];
    const normalizedUnavailableDays = [...new Set(unavailableDays)]
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= daysInMonth)
      .sort((left, right) => left - right);

    return {
      id: `person-${index + 1}`,
      name: normalizedName,
      unavailableDays: normalizedUnavailableDays,
      unavailableSet: new Set(normalizedUnavailableDays),
      totalAvailableDays: daysInMonth - normalizedUnavailableDays.length
    };
  });
}

function deviationImprovement(currentHours, addedHours, targetHours) {
  const before = currentHours - targetHours;
  const after = currentHours + addedHours - targetHours;
  return before * before - after * after;
}

function buildCandidates(availablePeople, requiredHours, maxHoursPerPerson) {
  const eligiblePeople = availablePeople.filter((person) => person.hours + requiredHours <= maxHoursPerPerson);
  const candidates = eligiblePeople.map((person) => ({
    members: [{ person, hours: requiredHours }]
  }));

  if (eligiblePeople.length < 2) {
    return candidates;
  }

  for (let firstIndex = 0; firstIndex < eligiblePeople.length - 1; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < eligiblePeople.length; secondIndex += 1) {
      candidates.push({
        members: [
          { person: eligiblePeople[firstIndex], hours: requiredHours },
          { person: eligiblePeople[secondIndex], hours: requiredHours }
        ]
      });
    }
  }

  return candidates;
}

function scoreCandidate(candidate, context) {
  const previousSet = new Set(context.previousAssignments);
  const overlapCount = candidate.members.filter((member) => previousSet.has(member.person.id)).length;
  const candidateTotalHours = candidate.members.reduce((sum, member) => sum + member.hours, 0);
  const candidateExtraHours = Math.max(0, candidateTotalHours - context.requiredHours);
  let score = 0;

  for (const member of candidate.members) {
    score += deviationImprovement(member.person.hours, member.hours, context.balancingTarget) / 120;
    score += deviationImprovement(member.person.hours, member.hours, context.desiredTarget) / 420;
    score += ((context.daysInMonth - member.person.totalAvailableDays) / Math.max(1, context.daysInMonth)) * 12;

    if (member.person.lastWorkedDay === context.dayNumber - 1) {
      score += 18;
    } else if (member.person.hours > 0) {
      score -= 10;
    }

    if (member.person.hours >= context.desiredTarget) {
      score -= 10;
    }

    if (member.person.hours + member.hours === context.maxHoursPerPerson) {
      score += 8;
    }
  }

  if (candidate.members.length === 1) {
    score += 14;
  } else {
    score -= 10;
  }

  if (candidateExtraHours > 0) {
    const remainingExtraNeed = Math.max(0, context.extraHoursNeeded - context.extraHoursScheduled);
    score += Math.min(candidateExtraHours, remainingExtraNeed) * 1.6;
    score -= Math.max(0, candidateExtraHours - remainingExtraNeed) * 3.2;
  }

  const remainingExtraNeedAfterCandidate = Math.max(
    0,
    context.extraHoursNeeded - context.extraHoursScheduled - candidateExtraHours
  );
  if (remainingExtraNeedAfterCandidate > context.remainingFutureExtraCapacity) {
    score -= (remainingExtraNeedAfterCandidate - context.remainingFutureExtraCapacity) * 6;
  }

  const remainingCapacityAfterCandidate = context.totalRemainingPersonCapacity - candidateTotalHours;
  if (remainingCapacityAfterCandidate < context.remainingMinimumHoursAfterToday) {
    score -= (context.remainingMinimumHoursAfterToday - remainingCapacityAfterCandidate) * 7;
  }

  if (context.previousAssignments.length > 0) {
    if (overlapCount === 0) {
      score -= 16;
    } else {
      score += overlapCount * 16;
    }
  }

  if (candidate.members.length === 1 && overlapCount === 1 && context.previousAssignments.length === 1) {
    score += 20;
  }

  if (candidate.members.length === 2 && overlapCount === 2) {
    score += 8;
  }

  score += context.rng() * 1.5;

  return score;
}

function chooseCandidate(scoredCandidates, rng) {
  const bestScore = scoredCandidates[0].score;
  const shortlist = scoredCandidates.filter((candidate, index) => index < 6 && candidate.score >= bestScore - 14);
  const weights = shortlist.map((candidate) => Math.exp((candidate.score - bestScore) / 4));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  let threshold = rng() * weightTotal;

  for (let index = 0; index < shortlist.length; index += 1) {
    threshold -= weights[index];
    if (threshold <= 0) {
      return shortlist[index].candidate;
    }
  }

  return shortlist[0].candidate;
}

function evaluateAttempt(attempt, context) {
  let penalty = attempt.warnings.length * 9000;
  penalty += attempt.splitDayCount * 8;
  penalty += attempt.transitionCount * 18;
  penalty += Math.abs(attempt.totalAssignedHours - context.targetScheduledHours) * 18;

  for (const person of attempt.personStates) {
    penalty += Math.pow(person.hours - context.balancingTarget, 2) * 2.6;
    penalty += Math.max(0, person.blocks - 1) * 45;
    penalty += person.splitDays * 5;
    penalty += Math.pow(Math.max(0, person.hours - context.desiredTarget), 2) * 1.4;
  }

  return penalty;
}

function runAttempt(context) {
  const rng = mulberry32(context.seed);
  const people = context.people.map((person) => ({
    ...person,
    unavailableSet: new Set(person.unavailableDays),
    hours: 0,
    workedDays: 0,
    splitDays: 0,
    blocks: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastWorkedDay: 0
  }));

  const warnings = [];
  const days = [];
  let previousAssignments = [];
  let splitDayCount = 0;
  let transitionCount = 0;
  let totalAssignedHours = 0;
  let extraHoursScheduled = 0;
  let remainingMinimumHours = context.minimumCoverageHours;

  for (const day of context.monthInfo.days) {
    const availablePeople = people.filter((person) => !person.unavailableSet.has(day.dayNumber));
    const remainingMinimumHoursAfterToday = remainingMinimumHours - day.requiredHours;
    const totalRemainingPersonCapacity = people.reduce(
      (sum, person) => sum + Math.max(0, context.desiredTarget - person.hours),
      0
    );

    if (availablePeople.length === 0) {
      warnings.push(`${day.dateIso}: nincs elerheto ember.`);
      days.push({
        ...day,
        assignments: []
      });
      previousAssignments = [];
      remainingMinimumHours = remainingMinimumHoursAfterToday;
      continue;
    }

    const candidates = buildCandidates(availablePeople, day.requiredHours, context.desiredTarget);

    if (candidates.length === 0) {
      warnings.push(
        `${day.dateIso}: nincs olyan elerheto ember, akinek meg beleferne a ${day.requiredHours} oras muszak a 168 oras plafonba.`
      );
      days.push({
        ...day,
        assignments: []
      });
      previousAssignments = [];
      remainingMinimumHours = remainingMinimumHoursAfterToday;
      continue;
    }

    const scoredCandidates = candidates
      .map((candidate) => ({
        candidate,
        score: scoreCandidate(candidate, {
          balancingTarget: context.balancingTarget,
          dayNumber: day.dayNumber,
          daysInMonth: context.monthInfo.daysInMonth,
          desiredTarget: context.desiredTarget,
          extraHoursNeeded: context.extraHoursNeeded,
          extraHoursScheduled,
          maxHoursPerPerson: context.desiredTarget,
          previousAssignments,
          remainingFutureExtraCapacity: remainingMinimumHoursAfterToday,
          remainingMinimumHoursAfterToday,
          requiredHours: day.requiredHours,
          rng
          ,
          totalRemainingPersonCapacity
        })
      }))
      .sort((left, right) => right.score - left.score);

    const chosenCandidate = chooseCandidate(scoredCandidates, rng);
    const assignedIds = new Set(chosenCandidate.members.map((member) => member.person.id));
    const chosenHours = chosenCandidate.members.reduce((sum, member) => sum + member.hours, 0);

    for (const person of people) {
      if (!assignedIds.has(person.id)) {
        if (person.lastWorkedDay === day.dayNumber - 1) {
          person.currentStreak = 0;
        }
        continue;
      }

      const assignedHours = chosenCandidate.members.find((member) => member.person.id === person.id).hours;

      if (person.lastWorkedDay === 0 || person.lastWorkedDay !== day.dayNumber - 1) {
        person.blocks += 1;
        person.currentStreak = 1;
      } else {
        person.currentStreak += 1;
      }

      person.longestStreak = Math.max(person.longestStreak, person.currentStreak);
      person.lastWorkedDay = day.dayNumber;
      person.hours += assignedHours;
      person.workedDays += 1;

      if (chosenCandidate.members.length === 2) {
        person.splitDays += 1;
      }
    }

    if (chosenCandidate.members.length === 2) {
      splitDayCount += 1;
    }

    totalAssignedHours += chosenHours;
    extraHoursScheduled += Math.max(0, chosenHours - day.requiredHours);

    if (previousAssignments.length > 0) {
      const overlapCount = previousAssignments.filter((personId) => assignedIds.has(personId)).length;
      if (overlapCount === 0) {
        transitionCount += 1;
      }
    }

    days.push({
      ...day,
      assignments: chosenCandidate.members.map((member) => ({
        personId: member.person.id,
        name: member.person.name,
        color: member.person.color,
        hours: member.hours
      }))
    });

    previousAssignments = [...assignedIds];
    remainingMinimumHours = remainingMinimumHoursAfterToday;
  }

  return {
    days,
    personStates: people,
    totalAssignedHours,
    warnings,
    extraHoursScheduled,
    splitDayCount,
    transitionCount
  };
}

function buildPersonSummaries(personStates) {
  return personStates.map((person) => ({
    id: person.id,
    name: person.name,
    color: person.color,
    totalHours: person.hours,
    targetDelta: person.hours - DESIRED_TARGET_HOURS,
    workedDays: person.workedDays,
    splitDays: person.splitDays,
    blocks: person.blocks,
    longestStreak: person.longestStreak,
    unavailableDays: person.unavailableDays
  }));
}

function buildSchedule(input) {
  const monthInfo = buildMonthInfo(input?.month, input?.exceptions);
  const normalizedPeople = normalizePeople(input?.people, monthInfo.daysInMonth).map((person, index) => ({
    ...person,
    color: buildPersonColor(index)
  }));
  const minimumCoverageHours = monthInfo.days.reduce((sum, day) => sum + day.requiredHours, 0);
  const maximumAssignableHours = minimumCoverageHours * 2;
  const desiredTarget = DESIRED_TARGET_HOURS;
  const targetTotalHours = normalizedPeople.length * desiredTarget;
  const targetScheduledHours = Math.min(targetTotalHours, maximumAssignableHours);
  const feasibleAverage = maximumAssignableHours / normalizedPeople.length;
  const balancingTarget = Math.min(desiredTarget, feasibleAverage);
  const extraHoursNeeded = Math.max(0, targetScheduledHours - minimumCoverageHours);
  const baseSeed = hashString(`${monthInfo.monthKey}:${normalizedPeople.map((person) => person.name).join("|")}`);

  let bestAttempt = null;

  for (let attemptIndex = 0; attemptIndex < MAX_ATTEMPTS; attemptIndex += 1) {
    const attempt = runAttempt({
      balancingTarget,
      desiredTarget,
      extraHoursNeeded,
      minimumCoverageHours,
      monthInfo,
      people: normalizedPeople,
      seed: baseSeed + attemptIndex * 977
    });

    attempt.score = evaluateAttempt(attempt, { balancingTarget, desiredTarget, targetScheduledHours });

    if (!bestAttempt || attempt.score < bestAttempt.score) {
      bestAttempt = attempt;
    }
  }

  const feasibleForAll168 = maximumAssignableHours >= targetTotalHours;
  const coveragePossibleWithinCap = minimumCoverageHours <= targetTotalHours;
  const warnings = [...bestAttempt.warnings];

  if (!feasibleForAll168) {
    warnings.unshift(
      `Ebben a honapban napi legfeljebb 2 emberrel osszesen ${maximumAssignableHours} ora oszthato ki. ${normalizedPeople.length} embernek igy nem lehet fejenkent 168 orat adni, az elmeleti plafon ${Math.min(desiredTarget, feasibleAverage).toFixed(1)} ora / fo.`
    );
  }

  if (!coveragePossibleWithinCap) {
    warnings.unshift(
      `Ha minden napra legalabb 1 embert osztunk, ahhoz ${minimumCoverageHours} ora kellene, de ${normalizedPeople.length} embernel a 168 oras plafon osszesen ${targetTotalHours} orat enged. Emiatt maradhatnak ures napok.`
    );
  }

  if (bestAttempt.totalAssignedHours < targetScheduledHours) {
    warnings.push(
      `A megadott kizart napokkal es a 168 oras plafonnal vegul ${bestAttempt.totalAssignedHours} ora lett kiosztva a celzott ${targetScheduledHours} ora helyett.`
    );
  }

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
      scheduledHours: bestAttempt.totalAssignedHours,
      averageRequiredHours: Number(feasibleAverage.toFixed(1)),
      desiredTargetHours: desiredTarget,
      feasibleForAll168,
      coveragePossibleWithinCap,
      theoreticalAverageHours: Number(feasibleAverage.toFixed(1)),
      maxFeasibleAverageHours: Number(Math.min(desiredTarget, feasibleAverage).toFixed(1)),
      scheduledAverageHours: Number((bestAttempt.totalAssignedHours / normalizedPeople.length).toFixed(1))
    },
    people: normalizedPeople.map((person) => ({
      id: person.id,
      name: person.name,
      color: person.color,
      unavailableDays: person.unavailableDays
    })),
    exceptions: monthInfo.exceptions,
    days: bestAttempt.days,
    personSummaries: buildPersonSummaries(bestAttempt.personStates),
    warnings
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCreatedAt(value) {
  return new Intl.DateTimeFormat("hu-HU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function buildScheduleCsv(entry) {
  const rows = [
    ["Honap", entry.monthLabel],
    ["Generalva", entry.createdAt ? formatCreatedAt(entry.createdAt) : ""],
    [],
    ["Datum", "Nap", "Tipus", "Orak szemelyenkent", "Beosztottak szama", "1. ember", "1. ember orai", "2. ember", "2. ember orai"]
  ];

  for (const day of entry.days) {
    const firstAssignment = day.assignments[0] || {};
    const secondAssignment = day.assignments[1] || {};

    rows.push([
      day.dateIso,
      day.weekdayLabel,
      getScheduleTypeLabel(day),
      day.requiredHours,
      day.assignments.length,
      firstAssignment.name || "",
      firstAssignment.hours || "",
      secondAssignment.name || "",
      secondAssignment.hours || ""
    ]);
  }

  rows.push([]);
  rows.push(["Ember", "Osszes ora", "Elteres a 168 oratol", "Ledolgozott napok", "Ketfos napok", "Blokkok"]);

  for (const person of entry.personSummaries) {
    rows.push([
      person.name,
      person.totalHours,
      person.targetDelta,
      person.workedDays,
      person.splitDays,
      person.blocks
    ]);
  }

  return `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(";")).join("\n")}`;
}

function buildScheduleHtml(entry) {
  const legendMarkup = entry.people
    .map(
      (person) => `
        <span class="legend-chip" style="${buildPersonColorVariables(person.color)}">
          <span class="legend-swatch"></span>
          ${escapeHtml(person.name)}
        </span>`
    )
    .join("");

  const warningMarkup = entry.warnings.length
    ? `<section class="warnings"><h2>Megjegyzesek</h2><ul>${entry.warnings
        .map((warning) => `<li>${escapeHtml(warning)}</li>`)
        .join("")}</ul></section>`
    : "";

  const peopleMarkup = entry.personSummaries
    .map(
      (person) => `
        <article class="person-card person-colored" style="${buildPersonColorVariables(person.color)}">
          <h3>${escapeHtml(person.name)}</h3>
          <p><strong>${person.totalHours}</strong> ora</p>
          <p>Eltetes a 168 oratol: ${person.targetDelta >= 0 ? "+" : ""}${person.targetDelta} ora</p>
          <p>Blokkok: ${person.blocks} | Leghosszabb sorozat: ${person.longestStreak} nap</p>
        </article>`
    )
    .join("");

  const daysMarkup = entry.days
    .map((day) => {
      const assignments = day.assignments.length
        ? day.assignments
            .map(
              (assignment) =>
                `<li class="person-colored" style="${buildPersonColorVariables(assignment.color)}"><span>${escapeHtml(assignment.name)}</span><strong>${assignment.hours} ora</strong></li>`
            )
            .join("")
        : '<li><span>Nincs kiosztva</span><strong>0 ora</strong></li>';

      return `
        <tr>
          <td>${escapeHtml(day.dateIso)}</td>
          <td>${escapeHtml(day.weekdayLabel)}</td>
          <td>${getScheduleTypeLabel(day)}</td>
          <td>${day.requiredHours} ora / fo</td>
          <td><ul class="day-assignment-list">${assignments}</ul></td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beosztas - ${escapeHtml(entry.monthLabel)}</title>
  <style>
    :root {
      --paper: #fffaf1;
      --sand: #f0dbc2;
      --clay: #cf7b4a;
      --teal: #1d5d63;
      --ink: #19303b;
      --line: rgba(25, 48, 59, 0.12);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 40px 20px 80px;
      font-family: "Trebuchet MS", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(207, 123, 74, 0.18), transparent 28%),
        radial-gradient(circle at top right, rgba(29, 93, 99, 0.14), transparent 30%),
        linear-gradient(180deg, #fffdf7 0%, var(--paper) 100%);
    }

    .wrap {
      max-width: 1100px;
      margin: 0 auto;
    }

    header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: end;
      margin-bottom: 28px;
      padding-bottom: 18px;
      border-bottom: 1px solid var(--line);
    }

    h1,
    h2,
    h3 {
      font-family: Georgia, "Times New Roman", serif;
      margin: 0;
    }

    h1 {
      font-size: clamp(2rem, 4vw, 3rem);
    }

    p {
      margin: 6px 0 0;
    }

    .summary-grid,
    .people-grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      margin-bottom: 24px;
    }

    .summary-card,
    .person-card,
    .warnings,
    .table-card {
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid var(--line);
      border-radius: 22px;
      box-shadow: 0 14px 32px rgba(25, 48, 59, 0.08);
    }

    .summary-card,
    .person-card,
    .warnings {
      padding: 18px 20px;
    }

    .summary-card strong,
    .person-card strong {
      color: var(--teal);
    }

    .person-card.person-colored {
      border-color: var(--person-border, var(--line));
      background: linear-gradient(180deg, var(--person-surface, rgba(255, 255, 255, 0.96)), rgba(255, 255, 255, 0.94));
      box-shadow: inset 0 4px 0 var(--person-accent, var(--teal)), 0 14px 32px rgba(25, 48, 59, 0.08);
    }

    .person-card.person-colored strong,
    .day-assignment-list li.person-colored strong {
      color: var(--person-accent, var(--teal));
    }

    .person-card.person-colored h3,
    .day-assignment-list li.person-colored span {
      color: var(--person-text, var(--ink));
    }

    .person-card h3 {
      margin-bottom: 10px;
    }

    .legend {
      margin-bottom: 24px;
    }

    .legend h2 {
      margin-bottom: 12px;
    }

    .legend-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .legend-chip {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid var(--person-border, var(--line));
      background: var(--person-surface, rgba(255, 255, 255, 0.92));
      color: var(--person-text, var(--ink));
      font-weight: 600;
    }

    .legend-swatch {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--person-accent, var(--teal));
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.9);
    }

    .warnings {
      margin-bottom: 24px;
      border-color: rgba(207, 123, 74, 0.35);
      background: rgba(255, 243, 235, 0.96);
    }

    .warnings ul {
      margin: 12px 0 0;
      padding-left: 20px;
    }

    .table-card {
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }

    th {
      background: rgba(29, 93, 99, 0.08);
      font-size: 0.9rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .day-assignment-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }

    .day-assignment-list li {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      padding: 8px 10px;
      border-radius: 12px;
      background: rgba(29, 93, 99, 0.06);
    }

    .day-assignment-list li.person-colored {
      border: 1px solid var(--person-border, var(--line));
      background: var(--person-surface, rgba(255, 255, 255, 0.96));
    }

    @media (max-width: 820px) {
      body {
        padding: 20px 12px 56px;
      }

      header {
        flex-direction: column;
        align-items: flex-start;
      }

      table,
      thead,
      tbody,
      th,
      td,
      tr {
        display: block;
      }

      thead {
        display: none;
      }

      td {
        padding: 10px 14px;
      }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <h1>${escapeHtml(entry.monthLabel)} beosztas</h1>
        <p>Generalva: ${escapeHtml(formatCreatedAt(entry.createdAt))}</p>
      </div>
      <div>
        <p>Osszes kiosztott ora: <strong>${entry.summary.scheduledHours}</strong></p>
        <p>Plafon: <strong>${entry.summary.desiredTargetHours} ora / fo</strong></p>
      </div>
    </header>

    <section class="summary-grid">
      <article class="summary-card">
        <h2>Honap</h2>
        <p><strong>${escapeHtml(entry.monthLabel)}</strong></p>
        <p>${entry.summary.totalDays} nap, ebbol ${entry.summary.workFreeDays} munkaszuneti vagy hetvegi nap.</p>
      </article>
      <article class="summary-card">
        <h2>Orakeret</h2>
        <p><strong>${entry.summary.scheduledHours} ora kiosztva</strong></p>
        <p>Minimum napi lefedes: ${entry.summary.minimumCoverageHours} ora, maximum 2 fovel: ${entry.summary.maximumAssignableHours} ora.</p>
      </article>
      <article class="summary-card">
        <h2>Allapot</h2>
        <p><strong>${entry.summary.feasibleForAll168 ? "A 168 oras cel elvileg teljesitheto" : "A 168 oras cel teljes egeszeben nem elerheto"}</strong></p>
        <p>A generator a folyamatos blokkokat es az egyenletes terhelest is figyeli.</p>
      </article>
    </section>

    ${warningMarkup}

    <section class="legend">
      <h2>Szinkulcs</h2>
      <div class="legend-grid">${legendMarkup}</div>
    </section>

    <section>
      <h2>Munkatarsak osszegzese</h2>
      <div class="people-grid">${peopleMarkup}</div>
    </section>

    <section class="table-card">
      <table>
        <thead>
          <tr>
            <th>Datum</th>
            <th>Nap</th>
            <th>Tipus</th>
            <th>Orak</th>
            <th>Beosztas</th>
          </tr>
        </thead>
        <tbody>
          ${daysMarkup}
        </tbody>
      </table>
    </section>
  </div>
</body>
</html>`;
}

module.exports = {
  DESIRED_TARGET_HOURS,
  buildSchedule,
  buildScheduleCsv,
  buildScheduleHtml
};