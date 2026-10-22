import { buildXlsContent, getXlsExportFileName } from "./EntryUtils.js";
import { getMonthInfo, getNextMonthValue } from "./Month.js";
import { cacheElements, getEventElement } from "./ScheduleAppDom.js";
import { createDayException, createPerson, createState, resetComposerState } from "./State.js";
import { shufflePeople } from "./shufflePeople.js";
import {
  buildConfigMarkup,
  buildCurrentEntryMarkup,
  buildExceptionListMarkup,
  buildHistoryMarkup,
  buildPeopleMarkup,
  buildResultActionsMarkup,
  buildSectionHint
} from "./Templates.js";

import type { GenerateScheduleInput } from "@shared/types/GenerateScheduleInput";
import type { ScheduleEntry } from "@shared/types/ScheduleEntry";
import type { ScheduleApp } from "@shared/types/ScheduleUiTypes";
import type { SchedulerConfigSection, SchedulerConfigValues } from "@shared/types/SchedulerConfig";

type ApiConfigResponse = {
  error?: string;
  schedulerConfig?: {
    sections?: SchedulerConfigSection[];
    values?: Partial<SchedulerConfigValues>;
  };
};

type ApiHistoryResponse = {
  error?: string;
  history?: ScheduleEntry[];
};

type ApiGenerateResponse = {
  error?: string;
  entry?: ScheduleEntry;
};

type BrowserScheduleAppDependencies = {
  document: Document;
  window: Window;
};

type LegacyScheduleEntry = ScheduleEntry & {
  csvExportFileName?: string;
  csvExportPath?: string;
};

export function createScheduleApp({ document, window }: BrowserScheduleAppDependencies): ScheduleApp {
  const state = createState();
  const elements = cacheElements(document);

  function initializeState(): void {
    elements.monthInput.value = getNextMonthValue();
    resetComposerState(state);
  }

  function getNextExceptionDayNumber(): { dayNumber: number } {
    const monthInfo = getMonthInfo(elements.monthInput.value);
    const usedDays = new Set(state.exceptions.map((dayException) => dayException.dayNumber));
    const nextFreeDay = monthInfo.days.find((day) => !usedDays.has(day.dayNumber));

    return nextFreeDay ? { dayNumber: nextFreeDay.dayNumber } : { dayNumber: 1 };
  }

  function renderExceptions(): void {
    elements.exceptionsList.innerHTML = buildExceptionListMarkup({
      exceptions: state.exceptions,
      monthInfo: getMonthInfo(elements.monthInput.value)
    });
  }

  function renderPeople(): void {
    elements.shufflePeopleButton.disabled = elements.generateButton.disabled || state.people.length < 2;
    elements.peopleList.innerHTML = buildPeopleMarkup({
      people: state.people,
      monthInfo: getMonthInfo(elements.monthInput.value)
    });
  }

  function renderConfig(): void {
    elements.configList.innerHTML = buildConfigMarkup({
      schedulerConfigError: state.schedulerConfigError,
      schedulerConfigReady: state.schedulerConfigReady,
      schedulerConfigSections: state.schedulerConfigSections,
      schedulerConfigValues: state.schedulerConfigValues
    });
    elements.resetConfigButton.disabled = !state.schedulerConfigReady;
  }

  function renderHistory(selectedId: string | undefined = state.currentEntry?.id): void {
    elements.historyList.innerHTML = buildHistoryMarkup({
      history: state.history,
      selectedId
    });
  }

  function renderCurrentEntry(): void {
    if (!state.currentEntry) {
      elements.resultEmpty.classList.remove("hidden");
      elements.resultContent.classList.add("hidden");
      elements.resultContent.innerHTML = "";
      elements.resultActions.innerHTML = "";
      renderHistory();
      return;
    }

    elements.resultEmpty.classList.add("hidden");
    elements.resultContent.classList.remove("hidden");
    elements.resultActions.innerHTML = buildResultActionsMarkup();
    elements.resultContent.innerHTML = buildCurrentEntryMarkup(state.currentEntry);
    renderHistory(state.currentEntry.id);
  }

  function setStatus(message: string, tone: string = ""): void {
    elements.formStatus.textContent = message;
    elements.formStatus.dataset.tone = tone;
  }

  function setBusy(isBusy: boolean): void {
    elements.generatorForm.classList.toggle("is-busy", isBusy);
    elements.generateButton.disabled = isBusy;
    elements.shufflePeopleButton.disabled = isBusy || state.people.length < 2;
  }

  function handleMonthChange(): void {
    const monthInfo = getMonthInfo(elements.monthInput.value);

    state.exceptions = state.exceptions
      .map((dayException) => ({
        ...dayException,
        dayNumber: Math.min(dayException.dayNumber, monthInfo.days.length)
      }))
      .filter((dayException) => dayException.dayNumber >= 1);

    state.people = state.people.map((person) => ({
      ...person,
      unavailableDays: person.unavailableDays.filter((dayNumber) => dayNumber <= monthInfo.days.length)
    }));

    renderExceptions();
    renderPeople();
  }

  function handleExceptionInput(event: Event): void {
    const target = getEventElement(event);
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
      return;
    }

    const action = target.dataset.action;
    if (action !== "exception-day" && action !== "exception-type") {
      return;
    }

    const dayException = state.exceptions.find((entry) => entry.id === target.dataset.exceptionId);
    if (!dayException) {
      return;
    }

    if (action === "exception-day") {
      dayException.dayNumber = Number(target.value);
    }

    if (action === "exception-type") {
      dayException.type = target.value === "dayoff" ? "dayoff" : "workday";
    }
  }

  function handleExceptionClick(event: Event): void {
    const eventElement = getEventElement(event);
    const target = eventElement?.closest<HTMLButtonElement>("button[data-action='remove-exception']");
    if (!target) {
      return;
    }

    state.exceptions = state.exceptions.filter((entry) => entry.id !== target.dataset.exceptionId);
    renderExceptions();
  }

  function handlePeopleInput(event: Event): void {
    const target = getEventElement(event);
    if (!(target instanceof HTMLInputElement) || target.dataset.action !== "name-input") {
      return;
    }

    const person = state.people.find((entry) => entry.id === target.dataset.personId);
    if (!person) {
      return;
    }

    person.name = target.value;
  }

  function handlePeopleClick(event: Event): void {
    const eventElement = getEventElement(event);
    const target = eventElement?.closest<HTMLButtonElement>("button[data-action]");
    if (!target) {
      return;
    }

    const person = state.people.find((entry) => entry.id === target.dataset.personId);
    if (!person) {
      return;
    }

    const monthInfo = getMonthInfo(elements.monthInput.value);

    switch (target.dataset.action) {
      case "toggle-day": {
        const dayNumber = Number(target.dataset.dayNumber);
        const selectedDays = new Set(person.unavailableDays);
        if (selectedDays.has(dayNumber)) {
          selectedDays.delete(dayNumber);
        } else {
          selectedDays.add(dayNumber);
        }
        person.unavailableDays = [...selectedDays].sort((left, right) => left - right);
        renderPeople();
        break;
      }
      case "toggle-weekends": {
        const weekendDays = monthInfo.days.filter((day) => day.weekend).map((day) => day.dayNumber);
        const selectedDays = new Set(person.unavailableDays);
        const everyWeekendSelected = weekendDays.every((dayNumber) => selectedDays.has(dayNumber));

        for (const dayNumber of weekendDays) {
          if (everyWeekendSelected) {
            selectedDays.delete(dayNumber);
          } else {
            selectedDays.add(dayNumber);
          }
        }

        person.unavailableDays = [...selectedDays].sort((left, right) => left - right);
        renderPeople();
        break;
      }
      case "clear-days": {
        person.unavailableDays = [];
        renderPeople();
        break;
      }
      case "remove-person": {
        state.people = state.people.filter((entry) => entry.id !== person.id);
        renderPeople();
        break;
      }
      default:
        break;
    }
  }

  function handleConfigChange(event: Event): void {
    const target = getEventElement(event);
    if (!(target instanceof HTMLInputElement) || target.dataset.action !== "config-input") {
      return;
    }

    const configKey = target.dataset.configKey as keyof SchedulerConfigValues | undefined;
    if (!configKey || !Object.prototype.hasOwnProperty.call(state.schedulerConfigDefaults, configKey)) {
      return;
    }

    if (target.value.trim() === "") {
      state.schedulerConfigValues[configKey] = state.schedulerConfigDefaults[configKey];
      renderConfig();
      return;
    }

    const nextValue = Number(target.value);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    state.schedulerConfigValues[configKey] = nextValue;
  }

  function buildPayload(): GenerateScheduleInput {
    const month = elements.monthInput.value;
    if (!month) {
      throw new Error("Valassz honapot.");
    }

    const people = state.people
      .map((person) => ({
        name: person.name.trim(),
        unavailableDays: [...person.unavailableDays]
      }))
      .filter((person) => person.name.length > 0);

    if (people.length === 0) {
      throw new Error("Adj meg legalabb egy nevet.");
    }

    const exceptions = state.exceptions.map((dayException) => ({
      dayNumber: Number(dayException.dayNumber),
      type: dayException.type
    }));

    const seenDays = new Set<number>();
    for (const dayException of exceptions) {
      if (seenDays.has(dayException.dayNumber)) {
        throw new Error("Egy naphoz csak egy kivetel adhato meg.");
      }
      seenDays.add(dayException.dayNumber);
    }

    const payload: GenerateScheduleInput = { month, people, exceptions };

    if (state.schedulerConfigReady && Object.keys(state.schedulerConfigValues).length > 0) {
      payload.config = Object.fromEntries(
        Object.entries(state.schedulerConfigValues).map(([key, value]) => [key, Number(value)])
      );
    }

    return payload;
  }

  async function loadSchedulerConfig(): Promise<void> {
    state.schedulerConfigReady = false;
    state.schedulerConfigError = "";
    renderConfig();

    try {
      const response = await fetch("/api/config");
      const data = (await response.json()) as ApiConfigResponse;
      if (!response.ok) {
        throw new Error(data.error || "Nem sikerult betolteni a scheduler beallitasait.");
      }

      const schedulerConfig = data.schedulerConfig || {};
      const schedulerConfigSections = Array.isArray(schedulerConfig.sections) ? schedulerConfig.sections : [];
      const schedulerConfigValues =
        schedulerConfig.values && typeof schedulerConfig.values === "object" ? schedulerConfig.values : {};

      if (schedulerConfigSections.length === 0 || Object.keys(schedulerConfigValues).length === 0) {
        throw new Error("A scheduler beallitasai nem teljesek.");
      }

      state.schedulerConfigSections = schedulerConfigSections;
      state.schedulerConfigDefaults = { ...schedulerConfigValues };
      state.schedulerConfigValues = { ...schedulerConfigValues };
      state.schedulerConfigReady = true;
    } catch (error) {
      state.schedulerConfigSections = [];
      state.schedulerConfigDefaults = {};
      state.schedulerConfigValues = {};
      state.schedulerConfigError = error instanceof Error ? error.message : "Nem sikerult betolteni a scheduler beallitasait.";
      state.schedulerConfigReady = false;
    }

    renderConfig();
  }

  async function loadHistory(selectedId?: string): Promise<void> {
    try {
      const response = await fetch("/api/history");
      const data = (await response.json()) as ApiHistoryResponse;
      if (!response.ok) {
        throw new Error(data.error || "Nem sikerult betolteni az elozmenyeket.");
      }

      state.history = Array.isArray(data.history) ? data.history : [];
      renderHistory(selectedId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Nem sikerult betolteni az elozmenyeket.";
      elements.historyList.innerHTML = buildSectionHint("Archivum", errorMessage);
    }
  }

  async function handleGenerate(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    try {
      const payload = buildPayload();
      setBusy(true);
      setStatus("A beosztas generalasa folyamatban van...");

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = (await response.json()) as ApiGenerateResponse;
      if (!response.ok) {
        throw new Error(data.error || "A generalas nem sikerult.");
      }

      state.currentEntry = data.entry || null;
      renderCurrentEntry();
      setStatus("A beosztas elkeszult. A HTML es az XLS export is elerheto.", "success");
      await loadHistory(state.currentEntry?.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "A generalas nem sikerult.";
      setStatus(errorMessage, "error");
    } finally {
      setBusy(false);
    }
  }

  function openExport(path: string | undefined): void {
    if (!path) {
      return;
    }

    window.open(path, "_blank", "noopener,noreferrer");
  }

  function downloadExport(path: string | undefined, fileName: string | undefined): void {
    if (!path || !fileName) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = path;
    anchor.download = fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  function downloadTextFile(content: string, fileName: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  function downloadXlsEntry(entry: LegacyScheduleEntry): void {
    if (entry.xlsExportPath) {
      downloadExport(entry.xlsExportPath, getXlsExportFileName(entry));
      return;
    }

    if (entry.csvExportPath) {
      downloadExport(entry.csvExportPath, entry.csvExportFileName || "beosztas-export.csv");
      return;
    }

    downloadTextFile(buildXlsContent(entry), getXlsExportFileName(entry), "application/vnd.ms-excel;charset=utf-8");
  }

  async function copyExportLink(path: string | undefined): Promise<void> {
    if (!path) {
      setStatus("Ehhez a beosztashoz nincs export link.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      setStatus("Az export linkje a vagolapra kerult.", "success");
    } catch {
      setStatus("A link masolasa nem sikerult ezen a bongeszon.", "error");
    }
  }

  function handleHistoryClick(event: Event): void {
    const eventElement = getEventElement(event);
    const target = eventElement?.closest<HTMLButtonElement>("button[data-history-action]");
    if (!target) {
      return;
    }

    const entry = state.history.find((item) => item.id === target.dataset.historyId);
    if (!entry) {
      return;
    }

    switch (target.dataset.historyAction) {
      case "show":
        state.currentEntry = entry;
        renderCurrentEntry();
        break;
      case "open-export":
        openExport(entry.exportPath);
        break;
      case "download-xls":
      case "download-csv":
        downloadXlsEntry(entry);
        break;
      case "copy-link":
        copyExportLink(entry.exportPath);
        break;
      default:
        break;
    }
  }

  function handleResultAction(event: Event): void {
    const eventElement = getEventElement(event);
    const target = eventElement?.closest<HTMLButtonElement>("button[data-result-action]");
    if (!target || !state.currentEntry) {
      return;
    }

    switch (target.dataset.resultAction) {
      case "open-export":
        openExport(state.currentEntry.exportPath);
        break;
      case "download-export":
        downloadExport(state.currentEntry.exportPath, state.currentEntry.exportFileName);
        break;
      case "download-xls":
      case "download-csv":
        downloadXlsEntry(state.currentEntry);
        break;
      case "copy-link":
        copyExportLink(state.currentEntry.exportPath);
        break;
      default:
        break;
    }
  }

  function attachEvents(): void {
    elements.addExceptionButton.addEventListener("click", () => {
      state.exceptions.push(createDayException(getNextExceptionDayNumber()));
      renderExceptions();
    });

    elements.addPersonButton.addEventListener("click", () => {
      state.people.push(createPerson());
      renderPeople();
    });

    elements.shufflePeopleButton.addEventListener("click", () => {
      if (elements.generateButton.disabled || state.people.length < 2) {
        return;
      }

      state.people = shufflePeople(state.people);
      renderPeople();
      setStatus("A munkatársak sorrendje megváltozott, mindenki megtartotta a saját adatait. Az új sorrendhez indítsd el a beosztás generálását.", "success");
    });

    elements.resetConfigButton.addEventListener("click", () => {
      state.schedulerConfigValues = { ...state.schedulerConfigDefaults };
      renderConfig();
      setStatus("A scheduler finomhangolo beallitasai visszaalltak a szerver alapertelmezett ertekeire.", "success");
    });

    elements.resetFormButton.addEventListener("click", () => {
      initializeState();
      renderExceptions();
      renderConfig();
      renderPeople();
      renderCurrentEntry();
      setStatus("A szerkeszto visszaallt az alapallapotra.", "success");
    });

    elements.monthInput.addEventListener("change", handleMonthChange);
    elements.exceptionsList.addEventListener("input", handleExceptionInput);
    elements.exceptionsList.addEventListener("click", handleExceptionClick);
    elements.configList.addEventListener("input", handleConfigChange);
    elements.configList.addEventListener("change", handleConfigChange);
    elements.peopleList.addEventListener("input", handlePeopleInput);
    elements.peopleList.addEventListener("click", handlePeopleClick);
    elements.generatorForm.addEventListener("submit", handleGenerate);
    elements.refreshHistoryButton.addEventListener("click", () => loadHistory(state.currentEntry?.id));
    elements.historyList.addEventListener("click", handleHistoryClick);
    elements.resultActions.addEventListener("click", handleResultAction);
  }

  async function init(): Promise<void> {
    initializeState();
    attachEvents();
    renderExceptions();
    renderConfig();
    renderPeople();
    renderCurrentEntry();
    await Promise.all([loadSchedulerConfig(), loadHistory()]);
  }

  return {
    init
  };
}
