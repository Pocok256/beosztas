import fs from "node:fs/promises";
import path from "node:path";

import type { GenerateScheduleInput } from "@shared/types/GenerateScheduleInput";
import type { ScheduleEntry } from "@shared/types/ScheduleEntry";

import { buildSchedule } from "@features/scheduler/buildSchedule";
import { buildScheduleHtml } from "@features/scheduler/buildScheduleHtml";
import { buildScheduleXls } from "@features/scheduler/buildScheduleXls";

import { buildExportBaseName } from "./buildExportBaseName";
import { createFileStamp } from "./createFileStamp";

type HistoryStore = {
  readHistory: () => Promise<ScheduleEntry[]>;
  writeHistory: (history: ScheduleEntry[]) => Promise<void>;
};

type CreateScheduleExportServiceParams = {
  exportDir: string;
  historyStore: HistoryStore;
};

type ScheduleExportService = {
  generateEntry: (input: GenerateScheduleInput) => Promise<ScheduleEntry>;
};

/**
 * Creates the export orchestration service for generated schedules.
 *
 * @param params - Export directory and history store dependencies.
 * @returns Export service API.
 */
export function createScheduleExportService({ exportDir, historyStore }: CreateScheduleExportServiceParams): ScheduleExportService {
  async function generateEntry(input: GenerateScheduleInput): Promise<ScheduleEntry> {
    const schedule = buildSchedule(input);
    const createdAt = new Date().toISOString();
    const exportBaseName = buildExportBaseName(schedule.month);
    const exportFileName = `${exportBaseName}.html`;
    const xlsExportFileName = `${exportBaseName}.xls`;
    const exportPath = `/exports/${exportFileName}`;
    const xlsExportPath = `/exports/${xlsExportFileName}`;
    const entry = {
      ...schedule,
      id: `${schedule.month}-${createFileStamp()}`,
      createdAt,
      xlsExportFileName,
      xlsExportPath,
      exportFileName,
      exportPath
    };
    const exportHtml = buildScheduleHtml(entry);
    const exportXls = buildScheduleXls(entry);
    const history = await historyStore.readHistory();

    history.unshift(entry);

    await Promise.all([
      fs.writeFile(path.join(exportDir, exportFileName), exportHtml, "utf8"),
      fs.writeFile(path.join(exportDir, xlsExportFileName), exportXls, "utf8"),
      historyStore.writeHistory(history)
    ]);

    return entry;
  }

  return {
    generateEntry
  };
}
