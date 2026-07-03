import { Commit, FileEntity } from './schema';
import { CommitLogEntry, DiffResult } from './parseHistory';

/**
 * Converts a raw commit and its corresponding diff into a standardized Commit entity.
 * 
 * @param commit The raw commit log entry.
 * @param diff The parsed diff result showing files changed in this commit.
 * @returns A structured Commit object matching the shared schema, including touched files.
 */
export function commitToEntity(commit: CommitLogEntry, diff: DiffResult): Commit {
  const files: FileEntity[] = diff.files.map((fileDiff) => ({
    path: fileDiff.file,
  }));

  return {
    hash: commit.hash,
    message: commit.message,
    author: commit.author,
    timestamp: commit.timestamp,
    files,
  };
}
