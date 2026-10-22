import type { AssignmentRole, PersonColor, ScheduleAssignment, ScheduleDay } from "@shared/types/ScheduleEntry";

export function buildPersonColor(index: number): PersonColor {
  const hue = (index * 67 + 18) % 360;

  return {
    accent: `hsl(${hue} 64% 44%)`,
    surface: `hsl(${hue} 68% 95%)`,
    border: `hsl(${hue} 52% 74%)`,
    text: `hsl(${hue} 40% 24%)`
  };
}

export function buildPersonColorVariables(color: PersonColor | null | undefined): string {
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

export function getScheduleTypeLabel(day: ScheduleDay): string {
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

export function escapeCsvCell(value: unknown): string {
  const normalized = value == null ? "" : String(value);

  if (/[,;"\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat("hu-HU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

/**
 * Params for resolving the effective assignment role.
 */
export type GetAssignmentRoleParams = {
  /** The assignment record to resolve. */
  assignment: ScheduleAssignment | undefined;
  /** Total number of assignments on the same day. */
  assignmentCount: number;
  /** Zero-based index of this assignment within the day. */
  index: number;
};

/**
 * Resolves the effective display role of a schedule assignment.
 *
 * @param params - Assignment resolution context.
 * @returns Resolved role or null when it cannot be inferred.
 */
export function getAssignmentRole(params: GetAssignmentRoleParams): AssignmentRole | null {
  const { assignment, assignmentCount, index } = params;

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

/**
 * Returns the human-readable label for an assignment role.
 *
 * @param params - Assignment resolution context.
 * @returns Display label string.
 */
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
