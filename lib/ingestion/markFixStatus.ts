import { cognee } from './cogneeClient';
import { logger } from './logger';

/**
 * Marks a previously ingested fix as reverted, held, or failed.
 * This pushes a semantic update to Cognee's graph, allowing
 * the UI (Person 2) and AI to realize that a historical fix did not actually solve the bug,
 * effectively updating the Fix entity's 'held' status in the graph.
 * 
 * @param commitHash The hash of the commit that originally attempted the fix.
 * @param reason Optional context on why it failed or resurfaced.
 */
export async function markFixAsReverted(commitHash: string, reason: string = "Bug resurfaced in production"): Promise<void> {
  logger.info(`[FixStatus] Marking fix attempt at commit ${commitHash} as REVERTED...`);

  // We push a highly structured update node to Cognee.
  // The LLM graph extraction will map this semantic update directly to the 
  // original Commit and Fix nodes using the exact commitHash.
  const description = `[ENTITY: FIX_STATUS_UPDATE]
Target Commit Hash: ${commitHash}
Status: HELD / REVERTED
Reason: ${reason}

[RELATION: INVALIDATES_FIX]
- ${commitHash}
`;

  const entry = { type: "text" as const, text: description };

  try {
    // Push into the same 'commits' dataset so it forms edges with existing nodes
    await cognee.remember([entry], 'commits');
    logger.info(`[FixStatus] Successfully pushed revert status for ${commitHash} to Cognee.`);
  } catch (error: any) {
    logger.error(`[FixStatus] Failed to push revert status for ${commitHash}:`, error);
    throw error;
  }
}
