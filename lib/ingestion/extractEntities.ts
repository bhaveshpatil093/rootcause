import { Commit, FileEntity, FunctionEntity } from './schema';
import { CommitLogEntry, DiffResult } from './parseHistory';
import { mapLinesToFunctions } from './mapFunctions';
import { simpleGit, SimpleGit } from 'simple-git';
import { logger } from './logger';

/**
 * Converts a raw commit and its corresponding diff into a standardized Commit entity,
 * mapping modified lines to actual function boundaries.
 * 
 * @param commit The raw commit log entry.
 * @param diff The parsed diff result showing files changed in this commit.
 * @param repoPath The local repository path to fetch historical file contents.
 * @param fastMode If true, skips historical file fetching and function mapping.
 * @returns A structured Commit object matching the shared schema, including touched files and functions.
 */
export async function commitToEntity(commit: CommitLogEntry, diff: DiffResult, repoPath: string, fastMode: boolean = false): Promise<Commit> {
  const git: SimpleGit = simpleGit({ baseDir: repoPath });
  const files: FileEntity[] = [];
  const functions: FunctionEntity[] = [];

  for (const fileDiff of diff.files) {
    const fileEntity = { path: fileDiff.file };
    files.push(fileEntity);

    if (fastMode) {
      continue;
    }

    try {
      // Fetch the full content of the file exactly as it was in this commit
      const fileContent = await git.show([`${commit.hash}:${fileDiff.file}`]);
      
      // We want to map both added and removed line ranges to functions
      const allTouchedRanges = [...fileDiff.addedRanges, ...fileDiff.removedRanges];
      
      const functionNames = mapLinesToFunctions(fileDiff.file, allTouchedRanges, fileContent);
      
      // Link each function back to its file and the commit that touched it
      for (const funcName of functionNames) {
        functions.push({
          name: funcName,
          file: fileDiff.file,
          commitHash: commit.hash
        });
      }
    } catch (err) {
      // Ignored: Usually means the file was deleted in this commit or it's binary
      logger.warn(`[extractEntities] Could not fetch content or map functions for ${fileDiff.file} at commit ${commit.hash}`);
    }
  }

  return {
    hash: commit.hash,
    message: commit.message,
    author: commit.author,
    timestamp: commit.timestamp,
    files,
    functions,
  };
}
