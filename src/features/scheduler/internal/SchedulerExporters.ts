import {
  buildPersonColorVariables,
  escapeCsvCell,
  formatCreatedAt,
  getAssignmentRole,
  getScheduleTypeLabel
} from "./SchedulerShared";
import { renderTemplate } from "./SchedulerTemplateRenderer";

import type { AssignmentRole, PersonSummary, ScheduleAssignment, ScheduleDay, ScheduleEntry } from "@shared/types/ScheduleEntry";

type CsvCellValue = string | number;

type SpreadsheetCellObject = {
  value: CsvCellValue;
  styleId?: string;
  type?: "Number" | "String";
};

type SpreadsheetCell = CsvCellValue | SpreadsheetCellObject;

type SpreadsheetRow = SpreadsheetCell[];

type MatrixPersonView = {
  name: string;
  style: string;
};

type MatrixCellView =
  | {
      isEmpty: true;
    }
  | {
      isEmpty: false;
      role: AssignmentRole | null;
      roleToneClass: string;
      shiftLabel: string;
      style: string;
    };

type MatrixRowView = {
  cells: MatrixCellView[];
  dayNumberLabel: string;
  toneClass: string;
  weekdayLabel: string;
};

type SpecialDayRowView = {
  dateIso: string;
  note: string;
  typeLabel: string;
};

type SummaryRowView = {
  blocks: number;
  name: string;
  primaryHours: number;
  secondaryHours: number;
  splitDays: number;
  targetDeltaLabel: string;
  totalHours: number;
  workedDays: number;
};

const CSV_WEEKDAY_SHORT_NAMES: string[] = ["V", "H", "K", "SZE", "CS", "P", "SZO"];

const XLS_DOCUMENT_HEADER = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>';
const XLS_WORKBOOK_OPEN =
  '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">';
const XLS_WORKBOOK_STYLES = `
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Top" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d7dee7"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d7dee7"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d7dee7"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d7dee7"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1f2937"/>
      <Interior ss:Color="#ffffff" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="header">
      <Font ss:Bold="1" ss:Color="#0f172a"/>
      <Interior ss:Color="#e2e8f0" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="dayLabel">
      <Font ss:Bold="1" ss:Color="#1e293b"/>
      <Interior ss:Color="#f8fafc" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="dayLabelSpecial">
      <Font ss:Bold="1" ss:Color="#1e293b"/>
      <Interior ss:Color="#fde68a" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="primaryAssignment">
      <Font ss:Bold="1" ss:Color="#7f1d1d"/>
      <Interior ss:Color="#fecaca" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="secondaryAssignment">
      <Font ss:Bold="1" ss:Color="#713f12"/>
      <Interior ss:Color="#fef08a" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="assignment">
      <Interior ss:Color="#dcfce7" ss:Pattern="Solid"/>
    </Style>
  </Styles>`;

function getCsvShiftLabel(day: ScheduleDay): string {
  if (day.requiredHours === 24) {
    return "K: 08:00 - 08:00";
  }

  if (day.requiredHours === 16) {
    return "K: 16:00 - 08:00";
  }

  return `K: ${day.requiredHours} ora`;
}

type BuildCsvAssignmentCellParams = {
  day: ScheduleDay;
  assignment: ScheduleAssignment;
  assignmentCount: number;
  index: number;
};

function buildCsvAssignmentCell(params: BuildCsvAssignmentCellParams): string {
  const { day, assignment, assignmentCount, index } = params;
  const baseLabel = getCsvShiftLabel(day);
  const role = getAssignmentRole({ assignment, assignmentCount, index });

  if (role === "primary" || role === "secondary") {
    return `${baseLabel} (${role})`;
  }

  return baseLabel;
}

function buildCsvDayNote(day: ScheduleDay): string {
  const notes: string[] = [];

  if (day.overrideLabel) {
    notes.push(day.overrideLabel);
  } else if (day.holidayLabel) {
    notes.push(`Unnepnap: ${day.holidayLabel}`);
  }

  if (day.assignments.length === 0) {
    notes.push("Nincs kiosztott ember.");
  }

  return notes.join(" | ");
}

export function buildScheduleCsv(entry: ScheduleEntry): string {
  const people = entry.people || [];
  const rows: CsvCellValue[][] = [["", "", ...people.map((person) => person.name)]];

  for (const day of entry.days) {
    const row = [
      CSV_WEEKDAY_SHORT_NAMES[day.weekdayIndex] || day.weekdayLabel || "",
      String(day.dayNumber).padStart(2, "0"),
      ...people.map(() => "")
    ];

    day.assignments.forEach((assignment, index) => {
      const personIndex = people.findIndex((person) => person.name === assignment.name);

      if (personIndex === -1) {
        return;
      }

      row[personIndex + 2] = buildCsvAssignmentCell({ day, assignment, assignmentCount: day.assignments.length, index });
    });

    rows.push(row);
  }

  const specialDays = entry.days.filter((day) => day.overrideType || day.holiday || day.assignments.length === 0);

  if (specialDays.length > 0) {
    rows.push([], ["Nap", "Tipus", "Megjegyzes"]);

    for (const day of specialDays) {
      rows.push([day.dateIso, getScheduleTypeLabel(day), buildCsvDayNote(day)]);
    }
  }

  rows.push(
    [],
    [
      "Ember",
      "Osszes ora",
      "Primary ora",
      "Secondary ora",
      "Elteres a 168 oratol",
      "Ledolgozott napok",
      "Ketfos napok",
      "Blokkok"
    ]
  );

  for (const person of entry.personSummaries) {
    rows.push([
      person.name,
      person.totalHours,
      (person.primaryHours || 0) + (person.soloHours || 0),
      person.secondaryHours || 0,
      person.targetDelta,
      person.workedDays,
      person.splitDays,
      person.blocks
    ]);
  }

  return `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")}`;
}

function escapeSpreadsheetText(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSpreadsheetCell(cell: SpreadsheetCell | null | undefined): string {
  if (cell && typeof cell === "object" && !Array.isArray(cell)) {
    const cellObject = cell as SpreadsheetCellObject;
    const styleId = cellObject.styleId ? ` ss:StyleID="${cellObject.styleId}"` : "";

    if (cellObject.value == null || cellObject.value === "") {
      return `<Cell${styleId}/>`;
    }

    const type =
      cellObject.type ||
      (typeof cellObject.value === "number" && Number.isFinite(cellObject.value) ? "Number" : "String");

    return `<Cell${styleId}><Data ss:Type="${type}">${escapeSpreadsheetText(cellObject.value)}</Data></Cell>`;
  }

  if (cell == null || cell === "") {
    return "<Cell/>";
  }

  const type = typeof cell === "number" && Number.isFinite(cell) ? "Number" : "String";
  return `<Cell><Data ss:Type="${type}">${escapeSpreadsheetText(cell)}</Data></Cell>`;
}

function buildSpreadsheetRow(cells: SpreadsheetRow): string {
  return `<Row>${cells.map((cell) => buildSpreadsheetCell(cell)).join("")}</Row>`;
}

function buildSpreadsheetWorksheet(name: string, rows: SpreadsheetRow[]): string {
  return `<Worksheet ss:Name="${escapeSpreadsheetText(name)}"><Table>${rows.map((row) => buildSpreadsheetRow(row)).join("")}</Table></Worksheet>`;
}

function getXlsAssignmentStyleId(role: AssignmentRole | null): string {
  if (role === "primary") {
    return "primaryAssignment";
  }

  if (role === "secondary") {
    return "secondaryAssignment";
  }

  return "assignment";
}

function getHtmlRoleToneClass(role: AssignmentRole | null): string {
  if (role === "primary") {
    return "border-red-200 bg-red-100 text-red-700";
  }

  if (role === "secondary") {
    return "border-yellow-300 bg-yellow-100 text-yellow-800";
  }

  return "border-emerald-200 bg-emerald-100 text-emerald-700";
}

function buildXlsSummaryRows(personSummaries: PersonSummary[]): SpreadsheetRow[] {
  const rows: SpreadsheetRow[] = [[
    { value: "Ember", styleId: "header" },
    { value: "Osszes ora", styleId: "header" },
    { value: "Primary ora", styleId: "header" },
    { value: "Secondary ora", styleId: "header" },
    { value: "Elteres a 168 oratol", styleId: "header" },
    { value: "Ledolgozott napok", styleId: "header" },
    { value: "Ketfos napok", styleId: "header" },
    { value: "Blokkok", styleId: "header" }
  ]];

  for (const person of personSummaries) {
    rows.push([
      person.name,
      person.totalHours,
      (person.primaryHours || 0) + (person.soloHours || 0),
      person.secondaryHours || 0,
      person.targetDelta,
      person.workedDays,
      person.splitDays,
      person.blocks
    ]);
  }

  return rows;
}

export function buildScheduleXls(entry: ScheduleEntry): string {
  const people = entry.people || [];
  const days = entry.days || [];
  const personSummaries = entry.personSummaries || [];
  const scheduleRows: SpreadsheetRow[] = [[
    { value: "", styleId: "header" },
    { value: "", styleId: "header" },
    ...people.map((person) => ({ value: person.name, styleId: "header" }))
  ]];

  for (const day of days) {
    const dayLabelStyleId = day.overrideType || day.holiday || day.weekend ? "dayLabelSpecial" : "dayLabel";
    const row = [
      { value: CSV_WEEKDAY_SHORT_NAMES[day.weekdayIndex] || day.weekdayLabel || "", styleId: dayLabelStyleId },
      { value: String(day.dayNumber).padStart(2, "0"), styleId: dayLabelStyleId },
      ...people.map(() => ({ value: "" }))
    ];

    day.assignments.forEach((assignment, index) => {
      const personIndex = people.findIndex((person) => person.name === assignment.name);

      if (personIndex === -1) {
        return;
      }

      const role = getAssignmentRole({ assignment, assignmentCount: day.assignments.length, index });
      row[personIndex + 2] = {
        value: buildCsvAssignmentCell({ day, assignment, assignmentCount: day.assignments.length, index }),
        styleId: getXlsAssignmentStyleId(role)
      };
    });

    scheduleRows.push(row);
  }

  const summaryRows = buildXlsSummaryRows(personSummaries);
  scheduleRows.push(
    [],
    [{ value: "Tabla nezetu osszesito", styleId: "header" }],
    ...summaryRows
  );

  const worksheets = [buildSpreadsheetWorksheet("Havi matrix", scheduleRows)];
  const specialDays = days.filter((day) => day.overrideType || day.holiday || day.assignments.length === 0);

  if (specialDays.length > 0) {
    const specialDayRows: SpreadsheetRow[] = [[
      { value: "Nap", styleId: "header" },
      { value: "Tipus", styleId: "header" },
      { value: "Megjegyzes", styleId: "header" }
    ]];

    for (const day of specialDays) {
      specialDayRows.push([day.dateIso, getScheduleTypeLabel(day), buildCsvDayNote(day)]);
    }

    worksheets.push(buildSpreadsheetWorksheet("Specialis napok", specialDayRows));
  }

  worksheets.push(buildSpreadsheetWorksheet("Osszesites", summaryRows));

  return `${XLS_DOCUMENT_HEADER}\n${XLS_WORKBOOK_OPEN}${XLS_WORKBOOK_STYLES}${worksheets.join("")}</Workbook>`;
}

function buildScheduleMatrixTableMarkup(entry: ScheduleEntry): string {
  const people = entry.people || [];
  const matrixPeople: MatrixPersonView[] = people.map((person) => ({
    name: person.name,
    style: buildPersonColorVariables(person.color)
  }));
  const rows: MatrixRowView[] = (entry.days || []).map((day) => {
    const toneClass = [
      day.weekend ? "is-weekend" : "",
      day.holiday ? "is-holiday" : "",
      day.overrideType ? "is-override" : "",
      day.assignments.length === 0 ? "is-empty" : ""
    ]
      .filter(Boolean)
      .join(" ");
    const cells: MatrixCellView[] = people.map((person) => {
      const assignmentIndex = day.assignments.findIndex((assignment) => assignment.name === person.name);

      if (assignmentIndex === -1) {
        return { isEmpty: true };
      }

      const assignment = day.assignments[assignmentIndex];
      const role = getAssignmentRole({ assignment, assignmentCount: day.assignments.length, index: assignmentIndex });

      return {
        isEmpty: false,
        role,
        roleToneClass: getHtmlRoleToneClass(role),
        shiftLabel: buildCsvAssignmentCell({ day, assignment, assignmentCount: day.assignments.length, index: assignmentIndex }),
        style: buildPersonColorVariables(assignment.color)
      };
    });

    return {
      cells,
      dayNumberLabel: String(day.dayNumber).padStart(2, "0"),
      toneClass,
      weekdayLabel: CSV_WEEKDAY_SHORT_NAMES[day.weekdayIndex] || day.weekdayLabel || ""
    };
  });

  return renderTemplate("ScheduleMatrixTable.pug", {
    people: matrixPeople,
    rows
  });
}

function buildSpecialDaysTableMarkup(entry: ScheduleEntry): string {
  const specialDays = (entry.days || []).filter((day) => day.overrideType || day.holiday || day.assignments.length === 0);

  if (specialDays.length === 0) {
    return "";
  }

  const rows: SpecialDayRowView[] = specialDays.map((day) => ({
    dateIso: day.dateIso,
    note: buildCsvDayNote(day),
    typeLabel: getScheduleTypeLabel(day)
  }));

  return renderTemplate("SpecialDaysSection.pug", {
    rows
  });
}

function buildSummaryTableMarkup(entry: ScheduleEntry): string {
  const people: SummaryRowView[] = (entry.personSummaries || []).map((person) => ({
    blocks: person.blocks,
    name: person.name,
    primaryHours: (person.primaryHours || 0) + (person.soloHours || 0),
    secondaryHours: person.secondaryHours || 0,
    splitDays: person.splitDays,
    targetDeltaLabel: `${person.targetDelta >= 0 ? "+" : ""}${person.targetDelta}`,
    totalHours: person.totalHours,
    workedDays: person.workedDays
  }));

  return renderTemplate("SummaryTable.pug", {
    people
  });
}

export function buildScheduleHtml(entry: ScheduleEntry): string {
  const warnings = entry.warnings || [];
  const summary = entry.summary || {};
  const people = entry.people || [];
  const days = entry.days || [];
  const createdAtLabel = entry.createdAt ? formatCreatedAt(entry.createdAt) : "";
  const uncoveredDays = days.filter((day) => day.assignments.length === 0).length;

  const summaryCards = [
    {
      title: "Honap",
      metric: entry.monthLabel,
      text: `${summary.totalDays || days.length} nap, ebbol ${summary.workFreeDays || 0} hetvegi vagy munkaszuneti nap.`,
      alert: false
    },
    {
      title: "Orakeret",
      metric: `${summary.scheduledHours || 0} ora`,
      text: `Minimum lefedes: ${summary.minimumCoverageHours || 0} ora, maximum kioszthato: ${summary.maximumAssignableHours || 0} ora.`,
      alert: false
    },
    {
      title: "Munkatarsak",
      metric: `${people.length} fo`,
      text: `Lefedetlen napok: ${uncoveredDays}, figyelmeztetesek: ${warnings.length}.`,
      alert: uncoveredDays > 0
    },
    {
      title: "168 oras cel",
      metric: summary.feasibleForAll168 ? "Teljesitheto" : "Nem teljesitheto teljesen",
      text: `A plafon ${summary.desiredTargetHours || 0} ora fejenkent, ezt a generator nem lepi at.`,
      alert: !summary.feasibleForAll168
    }
  ];

  const scheduleMatrixMarkup = buildScheduleMatrixTableMarkup(entry);
  const summaryTableMarkup = buildSummaryTableMarkup(entry);
  const specialDaysMarkup = buildSpecialDaysTableMarkup(entry);

  const summaryCardsMarkup = summaryCards
    .map((card) =>
      renderTemplate("SummaryCard.pug", {
        CARD_TONE_CLASS: card.alert ? "border-amber-300/60 bg-amber-50/80" : "border-slate-800/10 bg-white/90",
        METRIC: card.metric,
        TEXT: card.text,
        TITLE: card.title
      })
    )
    .join("");

  const warningMarkup = warnings.length
    ? renderTemplate("WarningSection.pug", {
        WARNING_COUNT: warnings.length,
        warnings
      })
    : "";

  return renderTemplate("ScheduleExportDocument.pug", {
    CREATED_AT_LABEL: createdAtLabel,
    DESIRED_TARGET_HOURS: summary.desiredTargetHours || 0,
    MINIMUM_COVERAGE_HOURS: summary.minimumCoverageHours || 0,
    MONTH_LABEL: entry.monthLabel,
    PEOPLE_COUNT: people.length,
    SCHEDULED_HOURS: summary.scheduledHours || 0,
    SCHEDULE_MATRIX_MARKUP: scheduleMatrixMarkup,
    SPECIAL_DAYS_MARKUP: specialDaysMarkup,
    SUMMARY_CARDS_MARKUP: summaryCardsMarkup,
    SUMMARY_TABLE_MARKUP: summaryTableMarkup,
    UNCOVERED_DAYS: uncoveredDays,
    WARNING_COUNT: warnings.length,
    WARNING_MARKUP: warningMarkup
  });
}
