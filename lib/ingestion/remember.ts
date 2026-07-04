import { cognee } from './cogneeClient';
import { Commit } from './schema';
import { logger } from './logger';
/**
 * Formats an array of Commit entities into clear text descriptions and pushes
 * them to Cognee memory in a single batch call. Batching is required because
 * Cognee's cognify pipeline short-circuits ("dataset already completed") on
 * subsequent remember() calls to the same dataset — calling remember() once
 * per commit would silently skip cognify for every commit after the first.
 *
 * @param commits The structured commit entities to remember.
 */

export async function pushCommitsToCognee(
  commits: Commit[],
  datasetName: string = 'commits'
): Promise<void> {
  const entries = commits.map((commitEntity) => {
    const shortHash = commitEntity.hash.substring(0, 7);
    const dateStr = new Date(commitEntity.timestamp).toISOString().split('T')[0];
    const fileNames = commitEntity.files?.map(f => f.path).join(', ') || 'none';
    const cleanMessage = commitEntity.message.split('\n')[0].trim();
    
    let description = `Commit ${shortHash} by ${commitEntity.author} on ${dateStr}: '${cleanMessage}' — touched files: ${fileNames}`;
    
    const funcDetails = commitEntity.functions
      ?.map(fn => `${fn.name} in ${typeof fn.file === 'string' ? fn.file : fn.file.path}`)
      .join(', ');
      
    if (funcDetails) {
      description += ` — touched functions: ${funcDetails}`;
    }
    
    if (commitEntity.bugs && commitEntity.bugs.length > 0) {
      const bugDescriptions = commitEntity.bugs.map(b => b.description).join(', ');
      description += `. This commit FIXES the bug: "${bugDescriptions}"`;
    }
    
    return { type: "text" as const, text: description };
  });

  logger.info(`[Cognee] Remembering ${entries.length} commits into dataset "${datasetName}"...`);
  await cognee.remember(entries, datasetName);
}