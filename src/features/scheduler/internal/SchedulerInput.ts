import Holidays from "date-holidays";
import { z } from "zod";

import type { GenerateScheduleInput } from "@shared/types/GenerateScheduleInput";
import type { DayException, ScheduleDay, SchedulePerson } from "@shared/types/ScheduleEntry";
import { ValidationError } from "@shared/errors/ValidationError";
import { GenerateScheduleInputSchema } from "@shared/validation/GenerateScheduleInputSchema";

import { MONTH_NAMES, WEEKDAY_NAMES } from "./SchedulerConstants";
import type { NormalizedPerson, SchedulerMonthDay, SchedulerMonthInfo } from "./SchedulerTypes";

type PublicHolidayInfo = {
  localName: string;
  englishName: string;
};

type ParsedMonth = {
  year: number;
  month: number;
};

function createValidationError(message: string): ValidationError {
  return new ValidationError({
    message,
    constraint: "schedule-input",
    statusCode: 400
  });
}

function createInputSchemaValidationError(issue: z.core.$ZodIssue): ValidationError {
  const rootPath = String(issue.path[0] ?? "");

  if (rootPath === "exceptions") {
    if (issue.path.length <= 1) {
      return createValidationError("A kivetelek listaja hibas.");
    }

    const exceptionIndex = Number(issue.path[1]);
    const exceptionNumber = Number.isInteger(exceptionIndex) ? exceptionIndex + 1 : 1;
    const exceptionField = String(issue.path[2] ?? "");

    if (exceptionField === "dayNumber") {
      return createValidationError(`A(z) ${exceptionNumber}. kivetel napja hibas.`);
    }

    if (exceptionField === "type") {
      return createValidationError(`A(z) ${exceptionNumber}. kivetel tipusa hibas.`);
    }

    return createValidationError("A kivetelek listaja hibas.");
  }

  if (rootPath === "people") {
    return createValidationError("Adj meg legalabb egy embert a beosztashoz.");
  }

  if (rootPath === "config") {
    if (issue.code === "unrecognized_keys") {
      return createValidationError(`Ismeretlen scheduler beallitas: ${issue.keys[0]}.`);
    }

    return createValidationError("A scheduler finomhangolo beallitasai hibasak.");
  }

  return new ValidationError({
    message: issue.message || "A scheduler bemenete hibas.",
    field: issue.path.join(".") || "input",
    constraint: issue.code || "zod-parse",
    statusCode: 400
  });
}

export function parseGenerateScheduleInput(input: unknown): GenerateScheduleInput {
  try {
    return GenerateScheduleInputSchema.parse(input);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      throw issue ? createInputSchemaValidationError(issue) : createValidationError("A scheduler bemenete hibas.");
    }

    throw error;
  }
}

function normalizeDayExceptions(dayExceptions: DayException[] | null | undefined, daysInMonth: number): DayException[] {
  if (dayExceptions == null) {
    return [];
  }

  if (!Array.isArray(dayExceptions)) {
    throw createValidationError("A kivetelek listaja hibas.");
  }

  const seenDays = new Set<number>();

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

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function getHungarianHolidayProvider(): Holidays {
  return new Holidays("HU");
}

function getPublicHolidayInfo(holidayProvider: Holidays, date: Date): PublicHolidayInfo | null {
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

function parseMonth(monthKey: string): ParsedMonth {
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

export function buildMonthInfo(
  monthKey: string,
  dayExceptions: DayException[] | null | undefined = []
): SchedulerMonthInfo {
  const { year, month } = parseMonth(monthKey);
  const daysInMonth = new Date(year, month, 0).getDate();
  const holidayProvider = getHungarianHolidayProvider();
  const normalizedExceptions = normalizeDayExceptions(dayExceptions, daysInMonth);
  const exceptionMap = new Map(normalizedExceptions.map((dayException) => [dayException.dayNumber, dayException]));
  const days: SchedulerMonthDay[] = [];

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    const date = new Date(year, month - 1, dayNumber);
    const weekdayIndex = date.getDay();
    const weekend = weekdayIndex === 0 || weekdayIndex === 6;
    const holidayInfo = getPublicHolidayInfo(holidayProvider, date);
    const dayException = exceptionMap.get(dayNumber) || null;
    const holiday = Boolean(holidayInfo);
    let workFreeDay = weekend || holiday;
    let requiredHours = workFreeDay ? 24 : 16;
    let overrideType: ScheduleDay["overrideType"] = null;
    let overrideLabel: string | null = null;

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

export function normalizePeople(people: SchedulePerson[], daysInMonth: number): NormalizedPerson[] {
  if (!Array.isArray(people) || people.length === 0) {
    throw createValidationError("Adj meg legalabb egy embert a beosztashoz.");
  }

  const seenNames = new Set<string>();

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
      color: null,
      unavailableDays: normalizedUnavailableDays,
      unavailableSet: new Set(normalizedUnavailableDays),
      totalAvailableDays: daysInMonth - normalizedUnavailableDays.length
    };
  });
}
