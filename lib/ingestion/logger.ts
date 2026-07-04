/**
 * Simple structured logger for the ingestion pipeline.
 * Can be swapped out for Pino or Winston in the future if needed.
 */
export const logger = {
  info: (message: string, meta?: any) => {
    if (meta !== undefined) {
      console.log(`\x1b[36m[RootCause]\x1b[0m ℹ️  ${message}`, meta);
    } else {
      console.log(`\x1b[36m[RootCause]\x1b[0m ℹ️  ${message}`);
    }
  },
  warn: (message: string, meta?: any) => {
    if (meta !== undefined) {
      console.warn(`\x1b[33m[RootCause]\x1b[0m ⚠️  ${message}`, meta);
    } else {
      console.warn(`\x1b[33m[RootCause]\x1b[0m ⚠️  ${message}`);
    }
  },
  error: (message: string, meta?: any) => {
    if (meta !== undefined) {
      console.error(`\x1b[31m[RootCause]\x1b[0m ❌ ${message}`, meta);
    } else {
      console.error(`\x1b[31m[RootCause]\x1b[0m ❌ ${message}`);
    }
  }
};
