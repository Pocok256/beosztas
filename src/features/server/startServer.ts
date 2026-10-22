import type { ServerAppOptions, StartedServer } from "@shared/types/ServerTypes";

import { startServer as startHttpServer } from "./internal/ServerApp";

/**
 * Starts the HTTP server with the resolved application wiring.
 *
 * @param params - Optional server startup overrides.
 * @returns Started server metadata.
 */
export async function startServer(params: ServerAppOptions = {}): Promise<StartedServer> {
  return (await startHttpServer(params)) as StartedServer;
}