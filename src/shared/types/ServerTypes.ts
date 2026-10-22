import type { Express } from "express";
import type { Server } from "node:http";

/**
 * Optional filesystem and binding overrides for the HTTP server.
 */
export type ServerAppOptions = {
  host?: string;
  port?: number;
  publicDir?: string;
  exportDir?: string;
  dataDir?: string;
  historyFile?: string;
};

/**
 * Resolved storage locations used by the server feature.
 */
export type ServerPaths = {
  dataDir: string;
  exportDir: string;
  historyFile: string;
  publicDir: string;
};

/**
 * Unstarted server application state returned by createApp.
 */
export type ServerAppState = {
  app: Express;
  ensureStorage: () => Promise<void>;
  host: string;
  paths: ServerPaths;
  port: number;
};

/**
 * Started HTTP server metadata returned by startServer.
 */
export type StartedServer = ServerAppState & {
  server: Server;
};