import { createFileStamp } from "./createFileStamp";

/**
 * Builds the base export file name for a generated month.
 *
 * @param month - Generated month key.
 * @returns Base file name without extension.
 */
export function buildExportBaseName(month: string): string {
  return `beosztas-${month}-${createFileStamp()}`;
}
