export type ScheduleAppElements = {
  generatorForm: HTMLFormElement;
  monthInput: HTMLInputElement;
  addExceptionButton: HTMLButtonElement;
  addPersonButton: HTMLButtonElement;
  shufflePeopleButton: HTMLButtonElement;
  exceptionsList: HTMLElement;
  configList: HTMLElement;
  resetConfigButton: HTMLButtonElement;
  resetFormButton: HTMLButtonElement;
  peopleList: HTMLElement;
  formStatus: HTMLElement;
  generateButton: HTMLButtonElement;
  historyList: HTMLElement;
  refreshHistoryButton: HTMLButtonElement;
  resultEmpty: HTMLElement;
  resultContent: HTMLElement;
  resultActions: HTMLElement;
};

function requireElement<TElement extends Element>(root: ParentNode, selector: string): TElement {
  const element = root.querySelector<TElement>(selector);

  if (!element) {
    throw new Error(`Hianyzo UI elem: ${selector}`);
  }

  return element;
}

export function getEventElement(event: Event): HTMLElement | null {
  return event.target instanceof HTMLElement ? event.target : null;
}

export function cacheElements(root: Document): ScheduleAppElements {
  return {
    generatorForm: requireElement<HTMLFormElement>(root, "#generator-form"),
    monthInput: requireElement<HTMLInputElement>(root, "#month-input"),
    addExceptionButton: requireElement<HTMLButtonElement>(root, "#add-exception-btn"),
    addPersonButton: requireElement<HTMLButtonElement>(root, "#add-person-btn"),
    shufflePeopleButton: requireElement<HTMLButtonElement>(root, "#shuffle-people-btn"),
    exceptionsList: requireElement<HTMLElement>(root, "#exceptions-list"),
    configList: requireElement<HTMLElement>(root, "#config-list"),
    resetConfigButton: requireElement<HTMLButtonElement>(root, "#reset-config-btn"),
    resetFormButton: requireElement<HTMLButtonElement>(root, "#reset-form-btn"),
    peopleList: requireElement<HTMLElement>(root, "#people-list"),
    formStatus: requireElement<HTMLElement>(root, "#form-status"),
    generateButton: requireElement<HTMLButtonElement>(root, "#generate-btn"),
    historyList: requireElement<HTMLElement>(root, "#history-list"),
    refreshHistoryButton: requireElement<HTMLButtonElement>(root, "#refresh-history-btn"),
    resultEmpty: requireElement<HTMLElement>(root, "#result-empty"),
    resultContent: requireElement<HTMLElement>(root, "#result-content"),
    resultActions: requireElement<HTMLElement>(root, "#result-actions")
  };
}
