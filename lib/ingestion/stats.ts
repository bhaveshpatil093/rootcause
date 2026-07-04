import { Commit } from './schema';

export interface IngestionStats {
  totalCommits: number;
  fixCommitsDetected: number;
  functionsMapped: number;
  skippedOrFailedCommits: number;
}

/**
 * Calculates summary statistics for a completed ingestion run.
 * 
 * @param entities The successfully extracted Commit entities.
 * @param errors An array of error strings encountered during commit processing.
 * @returns An object containing summary metrics.
 */
export function calculateStats(entities: Commit[], errors: string[]): IngestionStats {
  let fixCommitsDetected = 0;
  let functionsMapped = 0;

  for (const entity of entities) {
    if (entity.fixes && entity.fixes.length > 0) {
      fixCommitsDetected++;
    }
    
    if (entity.functions && entity.functions.length > 0) {
      functionsMapped += entity.functions.length;
    }
  }

  return {
    totalCommits: entities.length,
    fixCommitsDetected,
    functionsMapped,
    skippedOrFailedCommits: errors.length
  };
}
