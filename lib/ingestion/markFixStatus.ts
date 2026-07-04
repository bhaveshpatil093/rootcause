import { cognee, withRetry } from './cogneeClient';
import { logger } from './logger';

/**
 * Updates the status of an existing fix in the knowledge graph.
 * This is used for workflows where a human (or automated test) confirms a bug has resurfaced.
 * 
 * @param commitHash The hash of the original fix commit
 * @param reason Why the fix was invalidated
 */
export async function markFixAsReverted(commitHash: string, reason: string): Promise<void> {
  // Rather than trying to surgically update a single node property via raw vector searches,
  // we follow Cognee's append-only conversational model.
  // We emit a new STATUS UPDATE entity that semantically links back to the original commit.
  
  const statusUpdateText = `[ENTITY: FIX_STATUS]
TargetCommit: ${commitHash}
Status: HELD / REVERTED
Reason: ${reason}
`;

  try {
    const entry = { type: 'text' as const, text: statusUpdateText };
    await withRetry(() => cognee.remember([entry], 'commits'));
    console.log(`[INFO] [FixStatus] Successfully pushed revert status for ${commitHash} to Cognee.`);
  } catch (error: any) {
    logger.error(`[FixStatus] Failed to push revert status for ${commitHash}:`, error);
    throw error;
  }
}
