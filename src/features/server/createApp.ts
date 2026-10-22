import type { ServerAppOptions, ServerAppState } from "@shared/types/ServerTypes";

import { createApp as createServerApp } from "./internal/ServerApp";

/**
 * Creates the configured Express application and its bound infrastructure services.
 *
 * @param params - Optional server application overrides.
 * @returns Application state object with runtime dependencies.
 */
export function createApp(params: ServerAppOptions = {}): ServerAppState {
  return createServerApp(params);
}