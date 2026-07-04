import { Cognee } from '@cognee/cognee-ts';
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
    const cognee = new Cognee();
    
    // Construct a natural language query that relies on the graph having formed 
    // edges between (Commit)-[FIXES]->(Bug) and (Commit)-[TOUCHES]->(File/Function)
    let query = `what bugs were fixed in the file ${fileName}?`;
    if (functionName) {
      query = `what bugs were fixed that touched the function ${functionName} in the file ${fileName}?`;
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
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  const fileArg = process.argv[2] || 'cache.ts';
  const funcArg = process.argv[3]; // optional
  
  findRelatedBugs(fileArg, funcArg)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
