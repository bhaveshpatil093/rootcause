import { Commit, FileEntity, FunctionEntity, Bug, Fix } from './schema';
import { CommitLogEntry, DiffResult } from './parseHistory';
import { mapLinesToFunctions } from './mapFunctions';
import { simpleGit, SimpleGit } from 'simple-git';
import { isFixCommit, extractBugDescription } from './detectFixes';
import { logger } from './logger';

/**
 * Converts a raw commit and its corresponding diff into a standardized Commit entity,
 * mapping modified lines to actual function boundaries.
 * 
 * @param commit The raw commit log entry.
 * @param diff The parsed diff result showing files changed in this commit.
 * @param repoPath The local repository path to fetch historical file contents.
 * @param fastMode If true, skips historical file fetching and function mapping.
 * @param repoName Optional repository name tag.
 * @returns A structured Commit object matching the shared schema, including touched files and functions.
 */
export async function commitToEntity(commit: CommitLogEntry, diff: DiffResult, repoPath: string, fastMode: boolean = false, repoName?: string): Promise<Commit> {
  const git: SimpleGit = simpleGit({ baseDir: repoPath });
  const files: FileEntity[] = [];
  const functions: FunctionEntity[] = [];
  const bugs: Bug[] = [];
  const fixes: Fix[] = [];

  if (isFixCommit(commit.message)) {
    const bugDescription = extractBugDescription(commit.message);
    const bug: Bug = {
      description: bugDescription,
      errorSignature: 'unknown' // extracted later via LLM or left unknown
    };
    const fix: Fix = {
      commitHash: commit.hash,
      resolvesBug: bug,
      held: false
    };
    bugs.push(bug);
    fixes.push(fix);
  }

  for (const fileDiff of diff.files) {
    const fileEntity = { path: fileDiff.file };
    files.push(fileEntity);

    if (fastMode) {
      continue;
    }

    try {
      // Defensive check: Skip known massive/generated files that crash AST parsers or OOM
      const skipExtensions = ['.min.js', '.map', '.lock', '.svg', '.png', '.jpg'];
      const skipNames = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
      
      if (
        skipExtensions.some(ext => fileDiff.file.endsWith(ext)) || 
        skipNames.includes(fileDiff.file.split('/').pop() || '')
      ) {
        logger.info(`[extractEntities] Skipping known binary/generated file: ${fileDiff.file}`);
        continue;
      }

      // Fetch the full content of the file exactly as it was in this commit
      const fileContent = await git.show([`${commit.hash}:${fileDiff.file}`]);
      
      // Defensive check: Skip if file is unreasonably large (> 1MB)
      if (fileContent.length > 1024 * 1024) {
         logger.warn(`[extractEntities] Skipping massive file to prevent OOM: ${fileDiff.file}`);
         continue;
      }
      
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
    } catch (err: any) {
      // Ignored: Usually means the file was deleted in this commit, it's binary, or git show failed
      logger.warn(`[extractEntities] Could not fetch content or map functions for ${fileDiff.file} at commit ${commit.hash} - ${err.message}`);
    }
  }

  return {
    hash: commit.hash,
    message: commit.message,
    author: commit.author,
    timestamp: commit.timestamp,
    repoName,
    files,
    functions,
    bugs,
    fixes,
  };
}
