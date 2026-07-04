/**
 * Simple structured logger for the ingestion pipeline.
 * Can be swapped out for Pino or Winston in the future if needed.
 */
export const logger = {
  info: (message: string, meta?: any) => {
    if (meta !== undefined) {
      console.log(`[INFO] ${message}`, meta);
    } else {
      console.log(`[INFO] ${message}`);
    }
  },
  warn: (message: string, meta?: any) => {
    if (meta !== undefined) {
      console.warn(`[WARN] ${message}`, meta);
    } else {
      console.warn(`[WARN] ${message}`);
    }
  },
  error: (message: string, meta?: any) => {
    if (meta !== undefined) {
      console.error(`[ERROR] ${message}`, meta);
    } else {
      console.error(`[ERROR] ${message}`);
    }
  }
};
