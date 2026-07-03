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
