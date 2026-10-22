import { createScheduleApp } from "./internal/ScheduleApp.js";

export function bootstrapScheduleApp(): Promise<void> {
  const app = createScheduleApp({
    document,
    window
  });

  return app.init();
}

bootstrapScheduleApp().catch((error: unknown) => {
  console.error("A beosztas felulet inditasa nem sikerult.", error);
});
