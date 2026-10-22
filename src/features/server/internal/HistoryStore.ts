import fs from "node:fs/promises";

import type { ScheduleEntry } from "@shared/types/ScheduleEntry";
import type { ServerPaths } from "@shared/types/ServerTypes";

type HistoryStore = {
  ensureStorage: () => Promise<void>;
  readHistory: () => Promise<ScheduleEntry[]>;
  writeHistory: (history: ScheduleEntry[]) => Promise<void>;
};

/**
 * Creates the JSON-backed history store used by the HTTP API.
 *
 * @param paths - Resolved server filesystem paths.
 * @returns History store API.
 */
export function createHistoryStore(paths: ServerPaths): HistoryStore {
  async function ensureStorage() {
    await fs.mkdir(paths.dataDir, { recursive: true });
    await fs.mkdir(paths.exportDir, { recursive: true });

    try {
      await fs.access(paths.historyFile);
    } catch {
      await fs.writeFile(paths.historyFile, "[]", "utf8");
    }
  }

  async function readHistory() {
    const raw = await fs.readFile(paths.historyFile, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    return Array.isArray(parsed) ? (parsed as ScheduleEntry[]) : [];
  }

  async function writeHistory(history: ScheduleEntry[]) {
    await fs.writeFile(paths.historyFile, JSON.stringify(history, null, 2), "utf8");
  }

  return {
    ensureStorage,
    readHistory,
    writeHistory
  };
}