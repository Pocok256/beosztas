import { HUNGARIAN_DATE_TIME_FORMATTER } from "./Month.js";

import type { AssignmentRole, PersonColor, ScheduleAssignment, ScheduleEntry, SchedulePerson } from "@shared/types/ScheduleEntry";

export type DecoratedPerson = SchedulePerson & {
  color: PersonColor;
};

export type ColorMap = Map<string, PersonColor>;

type ColorEntity = Partial<ScheduleAssignment> & Partial<SchedulePerson>;

type SpreadsheetCellValue = string | number;

type SpreadsheetCellObject = {
  value: SpreadsheetCellValue;
  styleId?: string;
  type?: "Number" | "String";
};

type SpreadsheetCell = SpreadsheetCellValue | SpreadsheetCellObject;

type SpreadsheetRow = SpreadsheetCell[];

export function getNormalizedSummary(entry: ScheduleEntry): ScheduleEntry["summary"] {
  const summary = entry.summary || {};
  const desiredTargetHours = summary.desiredTargetHours || 168;
  const minimumCoverageHours =
    summary.minimumCoverageHours ||
    summary.totalRequiredHours ||
    entry.days.reduce((sum, day) => sum + day.requiredHours, 0);
  const maximumAssignableHours = summary.maximumAssignableHours || minimumCoverageHours * 2;
  const scheduledHours =
    summary.scheduledHours ||
    entry.days.reduce(
      (sum, day) => sum + day.assignments.reduce((daySum, assignment) => daySum + assignment.hours, 0),
      0
    );
  const targetTotalHours = summary.targetTotalHours || entry.people.length * desiredTargetHours;
  const holidayDays = summary.holidayDays || entry.days.filter((day) => day.holiday).length;
  const overrideDays = summary.overrideDays || entry.days.filter((day) => Boolean(day.overrideType)).length;
  const overrideWorkdayDays =
    summary.overrideWorkdayDays || entry.days.filter((day) => day.overrideType === "workday").length;
  const overrideDayoffDays =
    summary.overrideDayoffDays || entry.days.filter((day) => day.overrideType === "dayoff").length;
  const workFreeDays =
    summary.workFreeDays || entry.days.filter((day) => day.workFreeDay || day.weekend || day.holiday).length;
  const weekdayDays =
    summary.weekdayDays || entry.days.filter((day) => !(day.workFreeDay || day.weekend || day.holiday)).length;

  return {
    totalDays: summary.totalDays || entry.days.length,
    weekendDays: summary.weekendDays || entry.days.filter((day) => day.weekend).length,
    holidayDays,
    overrideDays,
    overrideWorkdayDays,
    overrideDayoffDays,
    weekdayDays,
    workFreeDays,
    desiredTargetHours,
    feasibleForAll168: summary.feasibleForAll168 ?? maximumAssignableHours >= targetTotalHours,
    coveragePossibleWithinCap: summary.coveragePossibleWithinCap ?? minimumCoverageHours <= targetTotalHours,
    minimumCoverageHours,
    totalRequiredHours: summary.totalRequiredHours || minimumCoverageHours,
    maximumAssignableHours,
    scheduledHours,
    averageRequiredHours:
      summary.averageRequiredHours || Number((minimumCoverageHours / Math.max(1, entry.days.length)).toFixed(1)),
    targetTotalHours,
    targetScheduledHours: summary.targetScheduledHours || Math.min(targetTotalHours, maximumAssignableHours),
    theoreticalAverageHours:
      summary.theoreticalAverageHours || Number((maximumAssignableHours / Math.max(1, entry.people.length)).toFixed(1)),
    maxFeasibleAverageHours:
      summary.maxFeasibleAverageHours ||
      summary.theoreticalAverageHours ||
      Number(Math.min(desiredTargetHours, maximumAssignableHours / Math.max(1, entry.people.length)).toFixed(1)),
    scheduledAverageHours:
      summary.scheduledAverageHours || Number((scheduledHours / Math.max(1, entry.people.length)).toFixed(1))
  };
}

export function getScheduleTypeLabel(day: ScheduleEntry["days"][number]): string {
  if (day.overrideType === "workday") {
    return "Kivetelezett munkanap";
  }

  if (day.overrideType === "dayoff") {
    return "Kivetelezett szunnap";
  }

  if (day.holiday && day.weekend) {
    return "Hetvege es unnepnap";
  }

  if (day.holiday) {
    return "Unnepnap";
  }

  return day.weekend ? "Hetvege" : "Hetkoznap";
}

type GetAssignmentRoleParams = {
  assignment: Partial<ScheduleAssignment> | undefined;
  assignmentCount: number;
  index: number;
};

export function getAssignmentRole({ assignment, assignmentCount, index }: GetAssignmentRoleParams): AssignmentRole | null {
  if (assignment?.role === "primary" || assignment?.role === "secondary") {
    return assignment.role;
  }

  if (assignment?.role === "solo") {
    return "primary";
  }

  if (assignmentCount === 1) {
    return "primary";
  }

  if (assignmentCount === 2) {
    return index === 0 ? "primary" : "secondary";
  }

  return null;
}

export function getAssignmentRoleLabel(params: GetAssignmentRoleParams): string {
  const role = getAssignmentRole(params);

  if (role === "primary") {
    return "Primary";
  }

  if (role === "secondary") {
    return "Secondary";
  }

  return "";
}

export function buildPersonColor(index: number): PersonColor {
  const hue = (index * 67 + 18) % 360;

  return {
    accent: `hsl(${hue} 64% 44%)`,
    surface: `hsl(${hue} 68% 95%)`,
    border: `hsl(${hue} 52% 74%)`,
    text: `hsl(${hue} 40% 24%)`
  };
}

export function normalizePersonColor(color: PersonColor | null | undefined, index: number): PersonColor {
  if (color?.accent && color?.surface && color?.border && color?.text) {
    return color;
  }

  return buildPersonColor(index);
}

export function buildPersonColorVariables(color: PersonColor): string {
  return [
    `--person-accent:${color.accent}`,
    `--person-surface:${color.surface}`,
    `--person-border:${color.border}`,
    `--person-text:${color.text}`
  ].join(";");
}

export function getDecoratedPeople(entry: ScheduleEntry): DecoratedPerson[] {
  return (entry.people || []).map((person, index) => ({
    ...person,
    color: normalizePersonColor(person.color, index)
  }));
}

export function getEntryPersonColorMap(entry: ScheduleEntry, decoratedPeople: DecoratedPerson[]): ColorMap {
  const colorMap: ColorMap = new Map();

  decoratedPeople.forEach((person, index) => {
    const color = normalizePersonColor(person.color, index);
    if (person.id) {
      colorMap.set(person.id, color);
    }
    if (person.name) {
      colorMap.set(person.name, color);
    }
  });

  (entry.personSummaries || []).forEach((person, index) => {
    const color = normalizePersonColor(person.color, decoratedPeople.length + index);
    if (person.id && !colorMap.has(person.id)) {
      colorMap.set(person.id, color);
    }
    if (person.name && !colorMap.has(person.name)) {
      colorMap.set(person.name, color);
    }
  });

  return colorMap;
}

export function getPersonColorForEntry(entity: ColorEntity, colorMap: ColorMap, fallbackIndex: number): PersonColor {
  return (
    entity?.color ||
    (entity?.personId ? colorMap.get(entity.personId) : undefined) ||
    (entity?.id ? colorMap.get(entity.id) : undefined) ||
    (entity?.name ? colorMap.get(entity.name) : undefined) ||
    buildPersonColor(fallbackIndex)
  );
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

function getSpreadsheetRoleStyleId(roleLabel: string): string {
  if (roleLabel === "Primary") {
    return "primaryAssignment";
  }

  if (roleLabel === "Secondary") {
    return "secondaryAssignment";
  }

  return "";
}

function buildXlsSummaryRows(entry: ScheduleEntry): SpreadsheetRow[] {
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

  return rows;
}

export function buildXlsContent(entry: ScheduleEntry): string {
  const detailRows: SpreadsheetRow[] = [
    [{ value: "Honap", styleId: "header" }, entry.monthLabel],
    [{ value: "Generalva", styleId: "header" }, HUNGARIAN_DATE_TIME_FORMATTER.format(new Date(entry.createdAt))],
    [],
    [
      { value: "Datum", styleId: "header" },
      { value: "Nap", styleId: "header" },
      { value: "Tipus", styleId: "header" },
      { value: "Orak szemelyenkent", styleId: "header" },
      { value: "Beosztottak szama", styleId: "header" },
      { value: "1. ember", styleId: "header" },
      { value: "1. szerep", styleId: "header" },
      { value: "1. ember orai", styleId: "header" },
      { value: "2. ember", styleId: "header" },
      { value: "2. szerep", styleId: "header" },
      { value: "2. ember orai", styleId: "header" }
    ]
  ];

  for (const day of entry.days) {
    const firstAssignment: Partial<ScheduleAssignment> = day.assignments[0] || {};
    const secondAssignment: Partial<ScheduleAssignment> = day.assignments[1] || {};
    const firstRole = getAssignmentRoleLabel({ assignment: firstAssignment, assignmentCount: day.assignments.length, index: 0 });
    const secondRole = getAssignmentRoleLabel({ assignment: secondAssignment, assignmentCount: day.assignments.length, index: 1 });

    detailRows.push([
      day.dateIso,
      day.weekdayLabel,
      getScheduleTypeLabel(day),
      day.requiredHours,
      day.assignments.length,
      firstAssignment.name || "",
      { value: firstRole, styleId: getSpreadsheetRoleStyleId(firstRole) },
      firstAssignment.hours || "",
      secondAssignment.name || "",
      { value: secondRole, styleId: getSpreadsheetRoleStyleId(secondRole) },
      secondAssignment.hours || ""
    ]);
  }

  const summaryRows = buildXlsSummaryRows(entry);
  detailRows.push(
    [],
    [{ value: "Tabla nezetu osszesito", styleId: "header" }],
    ...summaryRows
  );

  return `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40"><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Top" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d7dee7"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d7dee7"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d7dee7"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d7dee7"/></Borders><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1f2937"/><Interior ss:Color="#ffffff" ss:Pattern="Solid"/></Style><Style ss:ID="header"><Font ss:Bold="1" ss:Color="#0f172a"/><Interior ss:Color="#e2e8f0" ss:Pattern="Solid"/></Style><Style ss:ID="primaryAssignment"><Font ss:Bold="1" ss:Color="#7f1d1d"/><Interior ss:Color="#fecaca" ss:Pattern="Solid"/></Style><Style ss:ID="secondaryAssignment"><Font ss:Bold="1" ss:Color="#713f12"/><Interior ss:Color="#fef08a" ss:Pattern="Solid"/></Style></Styles>${buildSpreadsheetWorksheet("Beosztas", detailRows)}${buildSpreadsheetWorksheet("Osszesites", summaryRows)}</Workbook>`;
}

export function getXlsExportFileName(entry: ScheduleEntry): string {
  if (entry.xlsExportFileName) {
    return entry.xlsExportFileName;
  }

  if (entry.exportFileName) {
    return entry.exportFileName.replace(/\.html$/i, ".xls");
  }

  return `beosztas-${entry.month || "export"}.xls`;
}

export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
