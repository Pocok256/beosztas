import {
  configTemplate,
  currentEntryTemplate,
  exceptionListTemplate,
  historyListTemplate,
  peopleListTemplate,
  personCalendarTemplate,
  resultActionsTemplate,
  scheduleMatrixTemplate,
  sectionHintTemplate,
  specialDaysTemplate,
  summaryTableTemplate
} from "./CompiledTemplates.js";
import { HUNGARIAN_DATE_TIME_FORMATTER, WEEKDAY_SHORT } from "./Month.js";
import {
  buildPersonColorVariables,
  type ColorMap,
  type DecoratedPerson,
  getAssignmentRole,
  getDecoratedPeople,
  getEntryPersonColorMap,
  getNormalizedSummary,
  getPersonColorForEntry,
  getScheduleTypeLabel
} from "./EntryUtils.js";
import type { MonthInfo } from "./Month.js";
import type { UiDayException, UiPerson } from "./State.js";

import type { ScheduleAssignment, ScheduleDay, ScheduleEntry } from "@shared/types/ScheduleEntry";
import type { SchedulerConfigSection, SchedulerConfigValues } from "@shared/types/SchedulerConfig";

type BuildPersonCalendarMarkupParams = {
  monthInfo: MonthInfo;
  person: UiPerson;
};

type BuildExceptionListMarkupParams = {
  exceptions: UiDayException[];
  monthInfo: MonthInfo;
};

type BuildConfigMarkupParams = {
  schedulerConfigError: string;
  schedulerConfigReady: boolean;
  schedulerConfigSections: SchedulerConfigSection[];
  schedulerConfigValues: Partial<SchedulerConfigValues>;
};

type BuildPeopleMarkupParams = {
  people: UiPerson[];
  monthInfo: MonthInfo;
};

type BuildHistoryMarkupParams = {
  history: ScheduleEntry[];
  selectedId?: string;
};

const MATRIX_WEEKDAY_SHORT_NAMES: string[] = ["V", "H", "K", "SZE", "CS", "P", "SZO"];

export function buildSectionHint(title: string, text: string): string {
  return sectionHintTemplate({ title, text });
}

function formatConfigValue(value: number, step: number = 1): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  const decimalCount = String(step).includes(".") ? String(step).split(".")[1].length : 0;
  return Number(value)
    .toFixed(decimalCount)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

function buildPersonCalendarMarkup({ monthInfo, person }: BuildPersonCalendarMarkupParams): string {
  const selectedDays = new Set(person.unavailableDays);
  const firstDay = monthInfo.days[0] || null;
  const lastDay = monthInfo.days[monthInfo.days.length - 1] || null;
  const leadingPlaceholders = firstDay ? Array.from({ length: firstDay.weekdayIndexMonday }) : [];
  const trailingPlaceholders = lastDay ? Array.from({ length: 6 - lastDay.weekdayIndexMonday }) : [];
  const weekdays = WEEKDAY_SHORT.map((label, index) => ({
    isWeekend: index >= 5,
    label
  }));
  const days = monthInfo.days.map((day) => ({
    dayNumber: day.dayNumber,
    isSelected: selectedDays.has(day.dayNumber),
    isWeekend: day.weekend,
    shortName: day.shortName
  }));

  return personCalendarTemplate({
    days,
    leadingPlaceholders,
    personId: person.id,
    trailingPlaceholders,
    weekdays
  });
}

export function buildExceptionListMarkup({ exceptions, monthInfo }: BuildExceptionListMarkupParams): string {
  if (exceptions.length === 0) {
    return buildSectionHint("Kivetelek", "Nincs megadott kezi kivetel ehhez a honaphoz.");
  }

  return exceptionListTemplate({
    exceptions,
    monthDays: monthInfo.days
  });
}

export function buildConfigMarkup({
  schedulerConfigError,
  schedulerConfigReady,
  schedulerConfigSections,
  schedulerConfigValues
}: BuildConfigMarkupParams): string {
  if (schedulerConfigError) {
    return buildSectionHint(
      "Finomhangolas",
      `${schedulerConfigError} Ilyenkor a szerver tovabbra is a jelenlegi alapbeallitasokkal general.`
    );
  }

  if (!schedulerConfigReady || schedulerConfigSections.length === 0) {
    return buildSectionHint("Finomhangolas", "A scheduler finomhangolo beallitasai eppen tolodnek.");
  }

  const sections = schedulerConfigSections.map((section) => ({
    description: section.description,
    fields: section.fields.map((field) => {
      const value = schedulerConfigValues[field.key] ?? field.defaultValue;

      return {
        defaultValueLabel: formatConfigValue(field.defaultValue, field.step),
        description: field.description,
        envName: field.envName,
        key: field.key,
        label: field.label,
        max: field.max,
        maxLabel: formatConfigValue(field.max, field.step),
        min: field.min,
        minLabel: formatConfigValue(field.min, field.step),
        step: field.step,
        stepLabel: formatConfigValue(field.step, field.step),
        valueLabel: formatConfigValue(value, field.step)
      };
    }),
    title: section.title
  }));
  const fieldCount = schedulerConfigSections.reduce((sum, section) => sum + section.fields.length, 0);

  return configTemplate({
    fieldCount,
    sections
  });
}

export function buildPeopleMarkup({ people, monthInfo }: BuildPeopleMarkupParams): string {
  return peopleListTemplate({
    monthLabel: monthInfo.label,
    people: people.map((person, index) => ({
      calendarMarkup: buildPersonCalendarMarkup({ monthInfo, person }),
      canRemove: people.length > 1,
      id: person.id,
      index,
      name: person.name,
      unavailableDaysCount: person.unavailableDays.length
    }))
  });
}

export function buildHistoryMarkup({ history, selectedId }: BuildHistoryMarkupParams): string {
  if (history.length === 0) {
    return buildSectionHint("Archivum", "Meg nincs elmentett beosztas. Az uj generalasok itt fognak megjelenni.");
  }

  return historyListTemplate({
    history: history.map((entry) => {
      const summary = getNormalizedSummary(entry);

      return {
        createdAtLabel: HUNGARIAN_DATE_TIME_FORMATTER.format(new Date(entry.createdAt)),
        id: entry.id,
        isActive: selectedId === entry.id,
        monthLabel: entry.monthLabel,
        peopleCount: entry.people.length,
        scheduledHours: summary.scheduledHours,
        warningCount: (entry.warnings || []).length
      };
    })
  });
}

export function buildResultActionsMarkup(): string {
  return resultActionsTemplate();
}

function getMatrixShiftLabel(day: ScheduleDay): string {
  if (day.requiredHours === 24) {
    return "K: 08:00 - 08:00";
  }

  if (day.requiredHours === 16) {
    return "K: 16:00 - 08:00";
  }

  return `K: ${day.requiredHours} ora`;
}

function buildMatrixAssignmentLabel(
  day: ScheduleDay,
  assignment: ScheduleAssignment,
  assignmentCount: number,
  index: number
): string {
  const baseLabel = getMatrixShiftLabel(day);
  const role = getAssignmentRole({ assignment, assignmentCount, index });

  return role === "primary" || role === "secondary" ? `${baseLabel} (${role})` : baseLabel;
}

function buildScheduleMatrixMarkup(
  entry: ScheduleEntry,
  decoratedPeople: DecoratedPerson[],
  personColorMap: ColorMap
): string {
  const people = decoratedPeople.map((person, index) => ({
    name: person.name,
    style: buildPersonColorVariables(getPersonColorForEntry(person, personColorMap, index))
  }));
  const rows = entry.days.map((day) => {
    const assignmentByPersonName = new Map(
      day.assignments.map((assignment, index) => [assignment.name, { assignment, index }])
    );
    const toneClass = [
      day.weekend ? "is-weekend" : "",
      day.holiday ? "is-holiday" : "",
      day.overrideType ? "is-override" : "",
      day.assignments.length === 0 ? "is-empty" : ""
    ]
      .filter(Boolean)
      .join(" ");
    const cells = decoratedPeople.map((person, index) => {
      const match = assignmentByPersonName.get(person.name) as
        | { assignment: (typeof day.assignments)[number]; index: number }
        | undefined;

      if (!match) {
        return { isEmpty: true };
      }

      const color = getPersonColorForEntry(match.assignment, personColorMap, index);
      const role = getAssignmentRole({ assignment: match.assignment, assignmentCount: day.assignments.length, index: match.index });

      return {
        isEmpty: false,
        role,
        shiftLabel: buildMatrixAssignmentLabel(day, match.assignment, day.assignments.length, match.index),
        style: buildPersonColorVariables(color)
      };
    });

    return {
      cells,
      dayNumberLabel: String(day.dayNumber).padStart(2, "0"),
      toneClass,
      weekdayLabel: MATRIX_WEEKDAY_SHORT_NAMES[day.weekdayIndex] || day.weekdayLabel
    };
  });

  return scheduleMatrixTemplate({
    people,
    rows
  });
}

function buildSpecialDaysTableMarkup(entry: ScheduleEntry): string {
  const specialDays = entry.days.filter((day) => day.overrideType || day.holiday || day.assignments.length === 0);

  if (specialDays.length === 0) {
    return "";
  }

  const rows = specialDays.map((day) => {
    const notes: string[] = [];

    if (day.overrideLabel) {
      notes.push(day.overrideLabel);
    } else if (day.holidayLabel) {
      notes.push(`Unnepnap: ${day.holidayLabel}`);
    }

    if (day.assignments.length === 0) {
      notes.push("Nincs kiosztott ember.");
    }

    return {
      dateIso: day.dateIso,
      note: notes.join(" | "),
      typeLabel: getScheduleTypeLabel(day)
    };
  });

  return specialDaysTemplate({ rows });
}

function buildSummaryTableMarkup(entry: ScheduleEntry): string {
  return summaryTableTemplate({
    people: entry.personSummaries.map((person) => ({
      blocks: person.blocks,
      name: person.name,
      primaryHours: (person.primaryHours || 0) + (person.soloHours || 0),
      secondaryHours: person.secondaryHours || 0,
      splitDays: person.splitDays,
      targetDeltaLabel: `${person.targetDelta >= 0 ? "+" : ""}${person.targetDelta}`,
      totalHours: person.totalHours,
      workedDays: person.workedDays
    }))
  });
}

export function buildCurrentEntryMarkup(entry: ScheduleEntry): string {
  const summary = getNormalizedSummary(entry);
  const decoratedPeople = getDecoratedPeople(entry);
  const personColorMap = getEntryPersonColorMap(entry, decoratedPeople);
  const warnings = entry.warnings || [];
  const summaryCards = [
    {
      title: "Honap",
      metric: entry.monthLabel,
      text: `${summary.totalDays} nap, ebbol ${summary.workFreeDays} hetvegi vagy unnepnapi nap, koztuk ${summary.holidayDays} unnepnap.`,
      alert: false
    },
    {
      title: "Orakeret",
      metric: `${summary.scheduledHours} ora`,
      text: `Minimum lefedes: ${summary.minimumCoverageHours} ora, maximum kioszthato mennyiseg: ${summary.maximumAssignableHours} ora.`,
      alert: false
    },
    {
      title: "Kezi kivetelek",
      metric: `${summary.overrideDays} nap`,
      text: `${summary.overrideWorkdayDays} munkanapra, ${summary.overrideDayoffDays} szunnapra allitva.`,
      alert: false
    },
    {
      title: "168 oras cel",
      metric: summary.feasibleForAll168 ? "Elvileg kioszthato" : "Nem teljesitheto teljesen",
      text: `Szemelyenkent ${summary.desiredTargetHours} ora a plafon, ezt a generator nem lepi at.`,
      alert: !summary.feasibleForAll168 || !summary.coveragePossibleWithinCap
    }
  ];

  return currentEntryTemplate({
    createdAtLabel: HUNGARIAN_DATE_TIME_FORMATTER.format(new Date(entry.createdAt)),
    monthLabel: entry.monthLabel,
    peopleCount: entry.people.length,
    scheduleMatrixMarkup: buildScheduleMatrixMarkup(entry, decoratedPeople, personColorMap),
    specialDaysMarkup: buildSpecialDaysTableMarkup(entry),
    summaryCards,
    summaryTableMarkup: buildSummaryTableMarkup(entry),
    warnings
  });
}
