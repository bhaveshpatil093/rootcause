import { simpleGit, SimpleGit } from 'simple-git';
import { Commit as CommitLogEntry } from './schema';

/**
 * Retrieves the commit log for a given repository.
 *
 * @param repoPath The local path to the git repository.
 * @returns A promise that resolves to an array of CommitLogEntry objects, sorted most recent first.
 */
export async function getCommitLog(repoPath: string): Promise<CommitLogEntry[]> {
  const git: SimpleGit = simpleGit({ baseDir: repoPath });
  
  try {
    // simple-git's log() method returns commits sorted most recent first by default
    const logSummary = await git.log();

    return logSummary.all.map((commit) => ({
      hash: commit.hash,
      message: commit.message,
      // fallback to email if author_name is somehow missing
      author: commit.author_name || commit.author_email || 'Unknown',
      timestamp: commit.date, 
    }));
  } catch (error: any) {
    console.error(`Failed to get commit log for repository at ${repoPath}`);
    throw new Error(`Git log failed: ${error.message}`);
  }
}

export type { CommitLogEntry };

export interface ChangedLineRange {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
}

export interface FileDiff {
  file: string;
  ranges: ChangedLineRange[];
}

export interface DiffResult {
  commitHash: string;
  files: FileDiff[];
}

/**
 * Retrieves the changed files and changed line ranges for a given commit.
 *
 * @param repoPath The local path to the git repository.
 * @param commitHash The hash of the commit to inspect.
 * @returns A promise that resolves to a DiffResult object.
 */
export async function getCommitDiff(repoPath: string, commitHash: string): Promise<DiffResult> {
  const git: SimpleGit = simpleGit({ baseDir: repoPath });
  
  try {
    // git show <commitHash> --format= gives us the unified diff without the commit message header
    const diffString = await git.show([commitHash, '--format=']);
    
    const files: FileDiff[] = [];
    let currentFile: FileDiff | null = null;
    
    const lines = diffString.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        // e.g., diff --git a/path/to/file b/path/to/file
        const parts = line.split(' ');
        const bFile = parts[parts.length - 1];
        // Strip the b/ prefix to get the actual file path
        const filePath = bFile.replace(/^b\//, '');
        currentFile = { file: filePath, ranges: [] };
        files.push(currentFile);
      } else if (line.startsWith('@@ ') && currentFile) {
        // e.g., @@ -14,7 +14,8 @@
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (match) {
          currentFile.ranges.push({
            oldStart: parseInt(match[1], 10),
            oldLines: match[2] ? parseInt(match[2], 10) : 1,
            newStart: parseInt(match[3], 10),
            newLines: match[4] ? parseInt(match[4], 10) : 1,
          });
        }
      }
    }
    
    return {
      commitHash,
      files
    };
  } catch (error: any) {
    console.error(`Failed to get commit diff for ${commitHash} at ${repoPath}`);
    throw new Error(`Git show failed: ${error.message}`);
  }
}

