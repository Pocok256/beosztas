import path from "node:path";
import type { Server } from "node:http";
import express from "express";

import type { ServerAppOptions, ServerAppState, StartedServer } from "@shared/types/ServerTypes";

import { getSchedulerConfigManifest } from "@features/scheduler/getSchedulerConfigManifest";
import { createHistoryStore } from "./HistoryStore";
import { sendError } from "./HttpErrors";
import { resolvePaths } from "./Paths";
import { createScheduleExportService } from "./ScheduleExportService";

function createApp(options: ServerAppOptions = {}): ServerAppState {
  const app = express();
  const port = Number(options.port ?? process.env.PORT ?? 3000);
  const host = options.host || process.env.HOST || "0.0.0.0";
  const paths = resolvePaths(options);
  const historyStore = createHistoryStore(paths);
  const scheduleExportService = createScheduleExportService({
    exportDir: paths.exportDir,
    historyStore
  });

  app.use(express.json({ limit: "1mb" }));
  app.use("/exports", express.static(paths.exportDir));
  app.use(express.static(paths.publicDir));

  app.get("/api/history", async (_request, response) => {
    try {
      const history = await historyStore.readHistory();
      response.json({ history });
    } catch (error) {
      sendError(response, error as Error);
    }
  });

  app.get("/api/config", (_request, response) => {
    try {
      response.json({ schedulerConfig: getSchedulerConfigManifest() });
    } catch (error) {
      sendError(response, error as Error);
    }
  });

  app.post("/api/generate", async (request, response) => {
    try {
      const entry = await scheduleExportService.generateEntry(request.body);
      response.status(201).json({ entry });
    } catch (error) {
      sendError(response, error as Error);
    }
  });

  app.get("*", (_request, response) => {
    response.sendFile(path.join(paths.publicDir, "index.html"));
  });

  return {
    app,
    ensureStorage: historyStore.ensureStorage,
    host,
    paths,
    port
  };
}

async function startServer(options: ServerAppOptions = {}): Promise<StartedServer> {
  const { app, host, port, paths, ensureStorage } = createApp(options);

  await ensureStorage();

  const server = await new Promise<Server>((resolve, reject) => {
    const listener = app.listen(port, host, () => resolve(listener));
    listener.on("error", reject);
  });
  const address = server.address();
  const resolvedPort = typeof address === "object" && address ? address.port : port;

  console.log(`Beosztas app fut: http://${host === "0.0.0.0" ? "localhost" : host}:${resolvedPort}`);

  return {
    app,
    ensureStorage,
    host,
    paths,
    port: resolvedPort,
    server
  };
}

export { createApp, startServer };
