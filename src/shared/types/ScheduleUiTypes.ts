/**
 * Browser dependencies used to bootstrap the schedule UI.
 */
export type ScheduleAppDependencies = {
  document: unknown;
  window: unknown;
};

/**
 * Schedule UI application public surface.
 */
export type ScheduleApp = {
  init: () => Promise<void>;
};
