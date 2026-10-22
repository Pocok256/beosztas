export const HUNGARIAN_MONTH_FORMATTER = new Intl.DateTimeFormat("hu-HU", {
  year: "numeric",
  month: "long"
});

export const HUNGARIAN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("hu-HU", {
  dateStyle: "medium",
  timeStyle: "short"
});

export const WEEKDAY_SHORT = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];

export type MonthDay = {
  dayNumber: number;
  shortName: string;
  weekdayIndexMonday: number;
  weekend: boolean;
};

export type MonthInfo = {
  label: string;
  days: MonthDay[];
};

function getMondayFirstWeekdayIndex(dayIndex: number): number {
  return (dayIndex + 6) % 7;
}

export function getCurrentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getNextMonthValue(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthInfo(monthValue: string): MonthInfo {
  const [year, month] = String(monthValue || "").split("-").map(Number);
  const safeYear = Number.isInteger(year) ? year : new Date().getFullYear();
  const safeMonth = Number.isInteger(month) && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
  const daysInMonth = new Date(safeYear, safeMonth, 0).getDate();
  const days: MonthDay[] = [];

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    const date = new Date(safeYear, safeMonth - 1, dayNumber);
    const dayIndex = date.getDay();
    const weekdayIndexMonday = getMondayFirstWeekdayIndex(dayIndex);

    days.push({
      dayNumber,
      shortName: WEEKDAY_SHORT[weekdayIndexMonday],
      weekdayIndexMonday,
      weekend: dayIndex === 0 || dayIndex === 6
    });
  }

  return {
    label: HUNGARIAN_MONTH_FORMATTER.format(new Date(safeYear, safeMonth - 1, 1)),
    days
  };
}
