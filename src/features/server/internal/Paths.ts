import path from "node:path";

import type { ServerAppOptions, ServerPaths } from "@shared/types/ServerTypes";

const ROOT_DIR = process.cwd();

function resolvePaths(options: ServerAppOptions = {}): ServerPaths {
  const publicDir = options.publicDir || process.env.PUBLIC_DIR || path.join(ROOT_DIR, "dist", "public");
  const exportDir = options.exportDir || process.env.EXPORT_DIR || path.join(ROOT_DIR, "exports");
  const dataDir = options.dataDir || process.env.DATA_DIR || path.join(ROOT_DIR, "data");
  const historyFile = options.historyFile || path.join(dataDir, "history.json");

  return {
    dataDir,
    exportDir,
    historyFile,
    publicDir
  };
}

export { resolvePaths };