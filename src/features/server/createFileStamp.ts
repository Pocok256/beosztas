import { createFileStamp as createInternalFileStamp } from "./internal/createFileStamp";

/**
 * Builds a sortable timestamp suffix for exported file names.
 *
 * @returns Timestamp string with millisecond precision.
 */
export function createFileStamp(): string {
  return createInternalFileStamp();
}
