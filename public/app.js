const HUNGARIAN_MONTH_FORMATTER = new Intl.DateTimeFormat("hu-HU", {
  year: "numeric",
  month: "long"
});

const HUNGARIAN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("hu-HU", {
  dateStyle: "medium",
  timeStyle: "short"
});

const WEEKDAY_SHORT = ["V", "H", "K", "Sze", "Cs", "P", "Szo"];

const state = {
  exceptions: [],
  people: [],
  history: [],
  currentEntry: null
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  initializeState();
  attachEvents();
  renderExceptions();
  renderPeople();
  loadHistory();
});

function cacheElements() {
  elements.generatorForm = document.querySelector("#generator-form");
  elements.monthInput = document.querySelector("#month-input");
  elements.addExceptionButton = document.querySelector("#add-exception-btn");
  elements.addPersonButton = document.querySelector("#add-person-btn");
  elements.exceptionsList = document.querySelector("#exceptions-list");
  elements.resetFormButton = document.querySelector("#reset-form-btn");
  elements.peopleList = document.querySelector("#people-list");
  elements.formStatus = document.querySelector("#form-status");
  elements.generateButton = document.querySelector("#generate-btn");
  elements.historyList = document.querySelector("#history-list");
  elements.refreshHistoryButton = document.querySelector("#refresh-history-btn");
  elements.resultEmpty = document.querySelector("#result-empty");
  elements.resultContent = document.querySelector("#result-content");
  elements.resultActions = document.querySelector("#result-actions");
}

function initializeState() {
  elements.monthInput.value = getCurrentMonthValue();
  state.exceptions = [];
  state.people = [createPerson(), createPerson(), createPerson()];
}

function attachEvents() {
  elements.addExceptionButton.addEventListener("click", () => {
    state.exceptions.push(createDayException(getNextExceptionDayNumber()));
    renderExceptions();
  });

  elements.addPersonButton.addEventListener("click", () => {
    state.people.push(createPerson());
    renderPeople();
  });

  elements.resetFormButton.addEventListener("click", () => {
    initializeState();
    state.currentEntry = null;
    renderExceptions();
    renderPeople();
    renderCurrentEntry();
    setStatus("A form visszaallt az alapallapotra.", "success");
  });

  elements.monthInput.addEventListener("change", () => {
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
  });

  elements.exceptionsList.addEventListener("input", handleExceptionInput);
  elements.exceptionsList.addEventListener("click", handleExceptionClick);
  elements.peopleList.addEventListener("input", handlePeopleInput);
  elements.peopleList.addEventListener("click", handlePeopleClick);

  elements.generatorForm.addEventListener("submit", handleGenerate);
  elements.refreshHistoryButton.addEventListener("click", () => loadHistory(state.currentEntry?.id));
  elements.historyList.addEventListener("click", handleHistoryClick);
  elements.resultActions.addEventListener("click", handleResultAction);
}

function createPerson(overrides = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: overrides.name || "",
    unavailableDays: Array.isArray(overrides.unavailableDays) ? [...overrides.unavailableDays] : []
  };
}

function createDayException(overrides = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    dayNumber: overrides.dayNumber || 1,
    type: overrides.type || "workday"
  };
}

function getNextExceptionDayNumber() {
  const monthInfo = getMonthInfo(elements.monthInput.value);
  const usedDays = new Set(state.exceptions.map((dayException) => dayException.dayNumber));
  const nextFreeDay = monthInfo.days.find((day) => !usedDays.has(day.dayNumber));

  return nextFreeDay ? { dayNumber: nextFreeDay.dayNumber } : { dayNumber: 1 };
}

function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthInfo(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = [];

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    const date = new Date(year, month - 1, dayNumber);
    const dayIndex = date.getDay();
    days.push({
      dayNumber,
      shortName: WEEKDAY_SHORT[dayIndex],
      weekend: dayIndex === 0 || dayIndex === 6
    });
  }

  return {
    label: HUNGARIAN_MONTH_FORMATTER.format(new Date(year, month - 1, 1)),
    days
  };
}

function getNormalizedSummary(entry) {
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
  const workFreeDays = summary.workFreeDays || entry.days.filter((day) => day.workFreeDay || day.weekend || day.holiday).length;
  const weekdayDays =
    summary.weekdayDays ||
    entry.days.filter((day) => !(day.workFreeDay || day.weekend || day.holiday)).length;

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
    maximumAssignableHours,
    scheduledHours,
    targetTotalHours,
    targetScheduledHours: summary.targetScheduledHours || Math.min(targetTotalHours, maximumAssignableHours),
    maxFeasibleAverageHours:
      summary.maxFeasibleAverageHours ||
      summary.theoreticalAverageHours ||
      Number(Math.min(desiredTargetHours, maximumAssignableHours / Math.max(1, entry.people.length)).toFixed(1)),
    scheduledAverageHours:
      summary.scheduledAverageHours || Number((scheduledHours / Math.max(1, entry.people.length)).toFixed(1))
  };
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

function buildPersonColor(index) {
  const hue = (index * 67 + 18) % 360;

  return {
    accent: `hsl(${hue} 64% 44%)`,
    surface: `hsl(${hue} 68% 95%)`,
    border: `hsl(${hue} 52% 74%)`,
    text: `hsl(${hue} 40% 24%)`
  };
}

function normalizePersonColor(color, index) {
  if (color?.accent && color?.surface && color?.border && color?.text) {
    return color;
  }

  return buildPersonColor(index);
}

function buildPersonColorVariables(color) {
  return [
    `--person-accent:${color.accent}`,
    `--person-surface:${color.surface}`,
    `--person-border:${color.border}`,
    `--person-text:${color.text}`
  ].join(";");
}

function getDecoratedPeople(entry) {
  return (entry.people || []).map((person, index) => ({
    ...person,
    color: normalizePersonColor(person.color, index)
  }));
}

function getEntryPersonColorMap(entry, decoratedPeople) {
  const colorMap = new Map();

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

function getPersonColorForEntry(entity, colorMap, fallbackIndex) {
  return entity?.color || colorMap.get(entity?.personId) || colorMap.get(entity?.id) || colorMap.get(entity?.name) || buildPersonColor(fallbackIndex);
}

function escapeCsvCell(value) {
  const normalized = value == null ? "" : String(value);

  if (/[;"\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function buildCsvContent(entry) {
  const rows = [
    ["Honap", entry.monthLabel],
    ["Generalva", HUNGARIAN_DATE_TIME_FORMATTER.format(new Date(entry.createdAt))],
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

function renderExceptions() {
  const monthInfo = getMonthInfo(elements.monthInput.value);

  if (state.exceptions.length === 0) {
    elements.exceptionsList.innerHTML = '<p class="history-empty">Nincs megadott kezi kivetel.</p>';
    return;
  }

  elements.exceptionsList.innerHTML = state.exceptions
    .map((dayException) => {
      const dayOptions = monthInfo.days
        .map(
          (day) => `
            <option value="${day.dayNumber}" ${day.dayNumber === dayException.dayNumber ? "selected" : ""}>
              ${String(day.dayNumber).padStart(2, "0")}. nap · ${day.shortName}${day.weekend ? " · hetvege" : ""}
            </option>`
        )
        .join("");

      return `
        <article class="exception-card">
          <div class="exception-grid">
            <label class="field">
              <span>Nap</span>
              <select class="exception-select" data-action="exception-day" data-exception-id="${dayException.id}">
                ${dayOptions}
              </select>
            </label>

            <label class="field">
              <span>Feluliras tipusa</span>
              <select class="exception-select" data-action="exception-type" data-exception-id="${dayException.id}">
                <option value="workday" ${dayException.type === "workday" ? "selected" : ""}>Munkanap · 16 ora</option>
                <option value="dayoff" ${dayException.type === "dayoff" ? "selected" : ""}>Szunnap · 24 ora</option>
              </select>
            </label>

            <button type="button" class="mini-button remove-button" data-action="remove-exception" data-exception-id="${dayException.id}">Torol</button>
          </div>
        </article>`;
    })
    .join("");
}

function handleExceptionInput(event) {
  const action = event.target.dataset.action;
  if (action !== "exception-day" && action !== "exception-type") {
    return;
  }

  const dayException = state.exceptions.find((entry) => entry.id === event.target.dataset.exceptionId);
  if (!dayException) {
    return;
  }

  if (action === "exception-day") {
    dayException.dayNumber = Number(event.target.value);
  }

  if (action === "exception-type") {
    dayException.type = event.target.value;
  }
}

function handleExceptionClick(event) {
  const target = event.target.closest("button[data-action='remove-exception']");
  if (!target) {
    return;
  }

  state.exceptions = state.exceptions.filter((entry) => entry.id !== target.dataset.exceptionId);
  renderExceptions();
}

function getCsvExportFileName(entry) {
  if (entry.csvExportFileName) {
    return entry.csvExportFileName;
  }

  if (entry.exportFileName) {
    return entry.exportFileName.replace(/\.html$/i, ".csv");
  }

  return `beosztas-${entry.month || "export"}.csv`;
}

function renderPeople() {
  const monthInfo = getMonthInfo(elements.monthInput.value);

  elements.peopleList.innerHTML = state.people
    .map((person, index) => {
      const selectedDays = new Set(person.unavailableDays);
      const dayChips = monthInfo.days
        .map(
          (day) => `
            <button
              type="button"
              class="day-chip ${day.weekend ? "weekend" : ""} ${selectedDays.has(day.dayNumber) ? "is-selected" : ""}"
              data-action="toggle-day"
              data-person-id="${person.id}"
              data-day-number="${day.dayNumber}"
            >
              <strong>${day.dayNumber}</strong>
              <span>${day.shortName}</span>
            </button>`
        )
        .join("");

      return `
        <article class="person-card" data-person-id="${person.id}">
          <div class="person-card-head">
            <label class="field">
              <span>${index + 1}. munkatars neve</span>
              <input
                class="person-name-input"
                type="text"
                placeholder="Peldaul: Kovacs Anna"
                value="${escapeHtml(person.name)}"
                data-action="name-input"
                data-person-id="${person.id}"
              />
            </label>
            ${state.people.length > 1 ? `<button type="button" class="mini-button remove-button" data-action="remove-person" data-person-id="${person.id}">Torol</button>` : ""}
          </div>

          <div class="person-card-meta">
            <span>${monthInfo.label}</span>
            <span>${person.unavailableDays.length} tiltott nap kijelolve</span>
          </div>

          <div class="availability-toolbar">
            <strong>Nem vallalt napok</strong>
            <div class="mini-actions">
              <button type="button" class="mini-button" data-action="toggle-weekends" data-person-id="${person.id}">Hetvegek</button>
              <button type="button" class="mini-button" data-action="clear-days" data-person-id="${person.id}">Torol mind</button>
            </div>
          </div>

          <p class="chip-note">Kattints a napokra. A kijelolt napokon az adott ember nem lesz beoszthato.</p>
          <div class="day-chip-grid">${dayChips}</div>
        </article>`;
    })
    .join("");
}

function handlePeopleInput(event) {
  if (event.target.dataset.action !== "name-input") {
    return;
  }

  const person = state.people.find((entry) => entry.id === event.target.dataset.personId);
  if (!person) {
    return;
  }

  person.name = event.target.value;
}

function handlePeopleClick(event) {
  const target = event.target.closest("button[data-action]");
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

async function handleGenerate(event) {
  event.preventDefault();

  try {
    const payload = buildPayload();
    setBusy(true);
    setStatus("A beosztas generalasa folyamatban van...", "");

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "A generalas nem sikerult.");
    }

    state.currentEntry = data.entry;
    renderCurrentEntry();
    setStatus("A beosztas elkeszult. A HTML es a CSV export is elerheto.", "success");
    await loadHistory(state.currentEntry.id);
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setBusy(false);
  }
}

function buildPayload() {
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

  const seenDays = new Set();
  for (const dayException of exceptions) {
    if (seenDays.has(dayException.dayNumber)) {
      throw new Error("Egy naphoz csak egy kivetel adhato meg.");
    }
    seenDays.add(dayException.dayNumber);
  }

  return { month, people, exceptions };
}

function setStatus(message, tone) {
  elements.formStatus.textContent = message;
  elements.formStatus.className = "status-text";
  if (tone) {
    elements.formStatus.classList.add(tone);
  }
}

function setBusy(isBusy) {
  elements.generatorForm.classList.toggle("is-busy", isBusy);
  elements.generateButton.disabled = isBusy;
}

async function loadHistory(selectedId) {
  try {
    const response = await fetch("/api/history");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Nem sikerult betolteni az elozmenyeket.");
    }

    state.history = Array.isArray(data.history) ? data.history : [];
    renderHistory(selectedId);
  } catch (error) {
    elements.historyList.innerHTML = `<p class="history-empty">${escapeHtml(error.message)}</p>`;
  }
}

function renderHistory(selectedId = state.currentEntry?.id) {
  if (state.history.length === 0) {
    elements.historyList.innerHTML = '<p class="history-empty">Meg nincs elmentett beosztas.</p>';
    return;
  }

  elements.historyList.innerHTML = state.history
    .map((entry) => {
      const summary = getNormalizedSummary(entry);
      const isActive = selectedId === entry.id;
      return `
        <article class="history-card ${isActive ? "active" : ""}">
          <div class="history-card-top">
            <div>
              <h3>${escapeHtml(entry.monthLabel)}</h3>
              <small>${escapeHtml(HUNGARIAN_DATE_TIME_FORMATTER.format(new Date(entry.createdAt)))}</small>
            </div>
            <span>${entry.people.length} fo</span>
          </div>
          <p>${summary.scheduledHours} ora kiosztva, ${entry.warnings.length} figyelmeztetes.</p>
          <div class="history-actions">
            <button type="button" class="mini-button" data-history-action="show" data-history-id="${entry.id}">Megnyit</button>
            <button type="button" class="mini-button" data-history-action="open-export" data-history-id="${entry.id}">HTML</button>
            <button type="button" class="mini-button" data-history-action="download-csv" data-history-id="${entry.id}">CSV</button>
            <button type="button" class="mini-button" data-history-action="copy-link" data-history-id="${entry.id}">Link masol</button>
          </div>
        </article>`;
    })
    .join("");
}

function handleHistoryClick(event) {
  const target = event.target.closest("button[data-history-action]");
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
      renderHistory(entry.id);
      break;
    case "open-export":
      openExport(entry.exportPath);
      break;
    case "download-csv":
      downloadCsvEntry(entry);
      break;
    case "copy-link":
      copyExportLink(entry.exportPath);
      break;
    default:
      break;
  }
}

function renderCurrentEntry() {
  if (!state.currentEntry) {
    elements.resultEmpty.classList.remove("hidden");
    elements.resultContent.classList.add("hidden");
    elements.resultContent.innerHTML = "";
    elements.resultActions.innerHTML = "";
    renderHistory();
    return;
  }

  const entry = state.currentEntry;
  const summary = getNormalizedSummary(entry);
  const decoratedPeople = getDecoratedPeople(entry);
  const personColorMap = getEntryPersonColorMap(entry, decoratedPeople);
  elements.resultEmpty.classList.add("hidden");
  elements.resultContent.classList.remove("hidden");
  elements.resultActions.innerHTML = `
    <button type="button" class="ghost-button" data-result-action="open-export">HTML megnyitasa</button>
    <button type="button" class="ghost-button" data-result-action="download-export">HTML letoltese</button>
    <button type="button" class="ghost-button" data-result-action="download-csv">CSV letoltese</button>
    <button type="button" class="ghost-button" data-result-action="copy-link">Link masolasa</button>`;

  const summaryCards = [
    {
      title: "Honap",
      text: `<strong>${escapeHtml(entry.monthLabel)}</strong><p>${summary.totalDays} nap, ebbol ${summary.workFreeDays} hetvegi vagy unnepnapi nap, koztuk ${summary.holidayDays} unnepnap.</p>`,
      alert: false
    },
    {
      title: "Orakeret",
      text: `<strong>${summary.scheduledHours} ora kiosztva</strong><p>Minimum napi lefedes: ${summary.minimumCoverageHours} ora, maximum 2 fovel: ${summary.maximumAssignableHours} ora.</p>`,
      alert: false
    },
    {
      title: "Kezi kivetelek",
      text: `<strong>${summary.overrideDays} nap felulirva</strong><p>${summary.overrideWorkdayDays} munkanapra, ${summary.overrideDayoffDays} szunnapra allitva.</p>`,
      alert: false
    },
    {
      title: "168 oras cel",
      text: `<strong>${summary.feasibleForAll168 ? "Elvileg kioszthato" : "Nem oszthato ki mindenkinek"}</strong><p>A plafon szemelyenkent ${summary.desiredTargetHours} ora, ezt a generator semmilyen esetben nem lepi at.</p>`,
      alert: !summary.feasibleForAll168 || !summary.coveragePossibleWithinCap
    },
    {
      title: "Keszulet ideje",
      text: `<strong>${escapeHtml(HUNGARIAN_DATE_TIME_FORMATTER.format(new Date(entry.createdAt)))}</strong><p>Az export kulon HTML fajlkent is elerheto.</p>`,
      alert: false
    }
  ];

  const warningsMarkup = entry.warnings.length
    ? `
      <section class="warning-box">
        <h3>Figyelmeztetesek</h3>
        <ul>${entry.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>
      </section>`
    : "";

  const legendMarkup = decoratedPeople
    .map(
      (person, index) => `
        <span class="legend-chip" style="${buildPersonColorVariables(getPersonColorForEntry(person, personColorMap, index))}">
          <span class="legend-swatch"></span>
          ${escapeHtml(person.name)}
        </span>`
    )
    .join("");

  const peopleMarkup = entry.personSummaries
    .map((person, index) => {
      const color = getPersonColorForEntry(person, personColorMap, index);

      return `
        <article class="person-summary-card person-colored" style="${buildPersonColorVariables(color)}">
          <h3>${escapeHtml(person.name)}</h3>
          <p><strong>${person.totalHours} ora</strong> kiosztva.</p>
          <p>Eltetes a 168 oratol: ${person.targetDelta >= 0 ? "+" : ""}${person.targetDelta} ora.</p>
          <p>${person.blocks} blokk, ${person.longestStreak} napos leghosszabb sorozat, ${person.splitDays} ketfos nap.</p>
        </article>`;
    })
    .join("");

  const daysMarkup = entry.days
    .map((day) => {
      const assignments = day.assignments.length
        ? day.assignments
            .map((assignment, index) => {
              const color = getPersonColorForEntry(assignment, personColorMap, index);

              return `
                <div class="assignment-pill person-colored" style="${buildPersonColorVariables(color)}">
                  <span>${escapeHtml(assignment.name)}</span>
                  <strong>${assignment.hours} ora</strong>
                </div>`;
            })
            .join("")
        : '<div class="assignment-pill empty"><span>Nincs kiosztott ember</span><strong>0 ora</strong></div>';

      const holidayMarkup = day.holidayLabel
        ? `<p class="day-note">Unnepnap: ${escapeHtml(day.holidayLabel)}</p>`
        : "";
      const overrideMarkup = day.overrideLabel
        ? `<p class="day-note override-note">Kivetel: ${escapeHtml(day.overrideLabel)}</p>`
        : "";

      return `
        <article class="day-card ${day.workFreeDay ? "weekend" : ""} ${day.holiday ? "holiday" : ""} ${day.overrideType ? "override" : ""} ${day.assignments.length === 0 ? "uncovered" : ""}">
          <div class="day-card-head">
            <div class="day-card-date">
              <strong>${day.dayNumber}</strong>
              <span>${escapeHtml(day.weekdayLabel)}</span>
            </div>
            <span class="day-hours">${getScheduleTypeLabel(day)} · ${day.requiredHours} ora / fo</span>
          </div>
          ${holidayMarkup}
          ${overrideMarkup}
          <div class="assignment-stack">${assignments}</div>
        </article>`;
    })
    .join("");

  elements.resultContent.innerHTML = `
    <div class="result-meta">
      <p>${escapeHtml(entry.monthLabel)} beosztasa, ${entry.people.length} emberrel.</p>
      <p>${summary.weekdayDays} normal hetkoznap es ${summary.workFreeDays} hetvegi vagy unnepnapi nap.</p>
    </div>

    <section class="summary-grid">
      ${summaryCards
        .map(
          (card) => `
            <article class="summary-card ${card.alert ? "alert" : ""}">
              <h3>${card.title}</h3>
              ${card.text}
            </article>`
        )
        .join("")}
    </section>

    ${warningsMarkup}

    <section>
      <div class="panel-topline">
        <div>
          <p class="section-label">Szinkulcs</p>
          <h3>Munkatarsak szinei</h3>
        </div>
      </div>
      <div class="legend-row">${legendMarkup}</div>
    </section>

    <section>
      <div class="panel-topline">
        <div>
          <p class="section-label">Osszesites</p>
          <h3>Munkatarsankenti bontas</h3>
        </div>
      </div>
      <div class="person-summary-grid">${peopleMarkup}</div>
    </section>

    <section>
      <div class="panel-topline">
        <div>
          <p class="section-label">Napi nezet</p>
          <h3>Teljes havi beosztas</h3>
        </div>
      </div>
      <div class="days-grid">${daysMarkup}</div>
    </section>`;

  renderHistory(entry.id);
}

function handleResultAction(event) {
  const target = event.target.closest("button[data-result-action]");
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
    case "download-csv":
      downloadCsvEntry(state.currentEntry);
      break;
    case "copy-link":
      copyExportLink(state.currentEntry.exportPath);
      break;
    default:
      break;
  }
}

function openExport(path) {
  window.open(path, "_blank", "noopener,noreferrer");
}

function downloadExport(path, fileName) {
  const anchor = document.createElement("a");
  anchor.href = path;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function downloadTextFile(content, fileName, mimeType) {
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

function downloadCsvEntry(entry) {
  if (entry.csvExportPath) {
    downloadExport(entry.csvExportPath, getCsvExportFileName(entry));
    return;
  }

  downloadTextFile(buildCsvContent(entry), getCsvExportFileName(entry), "text/csv;charset=utf-8");
}

async function copyExportLink(path) {
  try {
    await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
    setStatus("Az export linkje a vagolapra kerult.", "success");
  } catch {
    setStatus("A link masolasa nem sikerult ezen a bongeszon.", "error");
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}