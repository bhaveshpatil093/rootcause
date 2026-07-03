import { Cognee } from '@cognee/cognee-ts';
import { Commit } from './schema';

// Initialize the Cognee client
const cognee = new Cognee();

/**
 * Formats a Commit entity into a clear text description and pushes it to Cognee memory.
 * 
 * @param commitEntity The structured commit entity to remember.
 */
export async function pushCommitToCognee(commitEntity: Commit): Promise<void> {
  // Shorten hash to 7 chars for readability
  const shortHash = commitEntity.hash.substring(0, 7);
  
  // Format the date (handle string or number format gracefully)
  const dateStr = new Date(commitEntity.timestamp).toISOString().split('T')[0];
  
  // Extract and join file names
  const fileNames = commitEntity.files?.map(f => f.path).join(', ') || 'none';
  
  // Clean up the message (removing newlines)
  const cleanMessage = commitEntity.message.split('\n')[0].trim();
  
  // Construct the text payload
  const description = `Commit ${shortHash} by ${commitEntity.author} on ${dateStr}: '${cleanMessage}' — touched files: ${fileNames}`;
  
  console.log(`[Cognee] Remembering: ${description}`);
  
  // Push to Cognee SDK using the expected data shape and dataset name
  await cognee.remember({ type: "text", text: description }, "commits");
}
