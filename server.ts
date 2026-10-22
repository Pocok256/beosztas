import "dotenv/config";

import { buildSchedule } from "@features/scheduler/buildSchedule";
import { buildScheduleHtml } from "@features/scheduler/buildScheduleHtml";
import { buildScheduleXls } from "@features/scheduler/buildScheduleXls";
import { getSchedulerConfigManifest } from "@features/scheduler/getSchedulerConfigManifest";
import { resolveSchedulerConfig } from "@features/scheduler/resolveSchedulerConfig";
import { buildExportBaseName } from "@features/server/buildExportBaseName";
import { createApp } from "@features/server/createApp";
import { createFileStamp } from "@features/server/createFileStamp";
import { startServer } from "@features/server/startServer";

async function bootstrapServer(): Promise<void> {
  try {
    await startServer({});
  } catch (error: unknown) {
    console.error("Nem sikerult elinditani az alkalmazast.", error);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void bootstrapServer();
}

export {
  buildExportBaseName,
  buildSchedule,
  buildScheduleHtml,
  buildScheduleXls,
  createApp,
  createFileStamp,
  getSchedulerConfigManifest,
  resolveSchedulerConfig,
  startServer
};
