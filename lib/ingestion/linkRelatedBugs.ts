import 'dotenv/config';
import { cognee } from './cogneeClient';
import { logger } from './logger';

/**
 * Diagnostic function to test if Cognee's graph properly linked bugs, commits, and files/functions.
 * This is NOT production code, but a way to validate that our semantic ingestion (e.g. "FIXES") 
 * created queryable edges in the memory graph.
 * 
 * @param fileName The name of the file to investigate.
 * @param functionName Optional function name within that file.
 */
export async function findRelatedBugs(fileName: string, functionName?: string) {
  try {
    
    // Construct a natural language query that relies on the graph having formed 
    // edges between (Commit)-[FIXES]->(Bug) and (Commit)-[TOUCHES]->(File/Function)
    let query = `what is the current status of the bug fixed in ${fileName}? Was the fix reverted or invalidated?`;
    if (functionName) {
      query = `what is the current status of the bug fixed in ${functionName} in ${fileName}? Was it reverted?`;
    }

    logger.info(`[Diagnostic] Querying Cognee for related bugs...`);
    logger.info(`[Diagnostic] Query: "${query}"`);

    // Ask Cognee to recall information based on the semantic query
    const answer = await cognee.recall(query);
    
    logger.info(`[Diagnostic] Recall Results:`, answer);
    
    return answer;
  } catch (error: any) {
    logger.error(`[Diagnostic] Failed to query related bugs:`, error);
    throw error;
  }
}

// Simple execution wrapper so this file can be run directly via `npx tsx`
if (import.meta.url === `file://${process.argv[1]}`) {
  const fileArg = process.argv[2] || 'cache.ts';
  const funcArg = process.argv[3]; // optional
  
  findRelatedBugs(fileArg, funcArg)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
