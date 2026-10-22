import type { ScheduleEntry } from "@shared/types/ScheduleEntry";
import type { SchedulerConfigSection, SchedulerConfigValues } from "@shared/types/SchedulerConfig";

export type UiPerson = {
  id: string;
  name: string;
  unavailableDays: number[];
};

export type UiDayException = {
  id: string;
  dayNumber: number;
  type: "workday" | "dayoff";
};

type CreatePersonOverrides = Partial<Pick<UiPerson, "name" | "unavailableDays">>;

type CreateDayExceptionOverrides = Partial<Pick<UiDayException, "dayNumber" | "type">>;

export type ScheduleUiState = {
  exceptions: UiDayException[];
  people: UiPerson[];
  history: ScheduleEntry[];
  currentEntry: ScheduleEntry | null;
  schedulerConfigDefaults: Partial<SchedulerConfigValues>;
  schedulerConfigValues: Partial<SchedulerConfigValues>;
  schedulerConfigSections: SchedulerConfigSection[];
  schedulerConfigReady: boolean;
  schedulerConfigError: string;
};

function createId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createPerson(overrides: CreatePersonOverrides = {}): UiPerson {
  return {
    id: createId(),
    name: overrides.name || "",
    unavailableDays: Array.isArray(overrides.unavailableDays) ? [...overrides.unavailableDays] : []
  };
}

export function createDayException(overrides: CreateDayExceptionOverrides = {}): UiDayException {
  return {
    id: createId(),
    dayNumber: overrides.dayNumber || 1,
    type: overrides.type || "workday"
  };
}

export function createState(): ScheduleUiState {
  return {
    exceptions: [],
    people: [],
    history: [],
    currentEntry: null,
    schedulerConfigDefaults: {},
    schedulerConfigValues: {},
    schedulerConfigSections: [],
    schedulerConfigReady: false,
    schedulerConfigError: ""
  };
}

export function resetComposerState(state: ScheduleUiState): void {
  state.exceptions = [];
  state.people = [createPerson(), createPerson(), createPerson()];
  state.currentEntry = null;
  state.schedulerConfigValues = { ...state.schedulerConfigDefaults };
  state.schedulerConfigError = "";
}
