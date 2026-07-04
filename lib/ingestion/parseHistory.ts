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

export interface LineRange {
  start: number;
  end: number;
}

export interface FileDiff {
  file: string;
  addedRanges: LineRange[];
  removedRanges: LineRange[];
}

export interface DiffResult {
  commitHash: string;
  files: FileDiff[];
}

// Helper to convert an array of line numbers into contiguous ranges
function toRanges(lines: number[]): LineRange[] {
  if (lines.length === 0) return [];
  const ranges: LineRange[] = [];
  let start = lines[0];
  let prev = lines[0];
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === prev + 1) {
      prev = lines[i];
    } else {
      ranges.push({ start, end: prev });
      start = lines[i];
      prev = lines[i];
    }
  }
  ranges.push({ start, end: prev });
  return ranges;
}

/**
 * Retrieves the changed files and exact added/removed line ranges for a given commit.
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
    let currentFile: { file: string, added: number[], removed: number[] } | null = null;
    
    let currentOldLine = 0;
    let currentNewLine = 0;
    
    const lines = diffString.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        // Process the previous file
        if (currentFile) {
          files.push({
            file: currentFile.file,
            addedRanges: toRanges(currentFile.added),
            removedRanges: toRanges(currentFile.removed)
          });
        }
        
        // e.g., diff --git a/path/to/file b/path/to/file
        const parts = line.split(' ');
        const bFile = parts[parts.length - 1];
        // Strip the b/ prefix to get the actual file path
        const filePath = bFile.replace(/^b\//, '');
        currentFile = { file: filePath, added: [], removed: [] };
      } else if (line.startsWith('@@ ') && currentFile) {
        // e.g., @@ -14,7 +14,8 @@
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (match) {
          currentOldLine = parseInt(match[1], 10);
          currentNewLine = parseInt(match[3], 10);
        }
      } else if (currentFile) {
        if (line.startsWith('--- ') || line.startsWith('+++ ')) {
          // File headers, ignore
        } else if (line.startsWith('-')) {
          currentFile.removed.push(currentOldLine);
          currentOldLine++;
        } else if (line.startsWith('+')) {
          currentFile.added.push(currentNewLine);
          currentNewLine++;
        } else if (line.startsWith(' ')) {
          currentOldLine++;
          currentNewLine++;
        }
      }
    }
    
    // Push the last file processed
    if (currentFile) {
      files.push({
        file: currentFile.file,
        addedRanges: toRanges(currentFile.added),
        removedRanges: toRanges(currentFile.removed)
      });
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

