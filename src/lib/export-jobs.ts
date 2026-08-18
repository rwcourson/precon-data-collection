/**
 * Export size thresholds referenced by the performance budget
 * (scripts/perf-check.mjs). The former in-process async export queue was
 * removed: it held job state in a module-level Map, which does not survive
 * across serverless instances, and nothing imported it. Exports above these
 * thresholds should be handled by a durable queue when one exists.
 */

/** Synchronous export threshold — larger jobs must go async. */
export const SYNC_EXPORT_ROW_LIMIT = 2000;
export const SYNC_EXPORT_BYTE_LIMIT = 25 * 1024 * 1024;

export function shouldExportAsync(
  rowEstimate: number,
  estimatedBytes: number
): boolean {
  return (
    rowEstimate > SYNC_EXPORT_ROW_LIMIT ||
    estimatedBytes > SYNC_EXPORT_BYTE_LIMIT
  );
}
