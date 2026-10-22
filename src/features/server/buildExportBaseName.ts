import { buildExportBaseName as buildInternalExportBaseName } from "./internal/buildExportBaseName";

/**
 * Builds the base export file name for a generated month.
 *
 * @param month - Generated month key.
 * @returns Base file name without extension.
 */
export function buildExportBaseName(month: string): string {
  return buildInternalExportBaseName(month);
}
