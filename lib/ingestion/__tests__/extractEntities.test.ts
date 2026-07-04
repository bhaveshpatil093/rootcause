import { describe, it, expect, vi, beforeEach } from 'vitest';
import { commitToEntity } from '../extractEntities';
import { CommitLogEntry, DiffResult } from '../parseHistory';

// Mock simple-git so we don't need a real repository for tests
vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    show: vi.fn(async (args: string[]) => {
      const target = args[0];
      if (target.includes('deleted.js')) {
        throw new Error("fatal: path 'deleted.js' does not exist");
      }
      if (target.includes('huge.js')) {
        return "a".repeat(2 * 1024 * 1024); // 2MB string to trigger OOM skip
      }
      return `function affectedFunction() {\n  console.log("hello");\n}\n`;
    })
  }))
}));

describe('commitToEntity', () => {
  const dummyRepo = '/fake/repo/path';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process a normal feature commit correctly', async () => {
    const commit: CommitLogEntry = {
      hash: 'a1b2c3d4e5f6',
      message: 'feat: add new feature X',
      author: 'Alice',
      timestamp: Date.now()
    };
    
    const diff: DiffResult = {
      commitHash: commit.hash,
      files: [
        { file: 'src/feature.js', addedRanges: [{ start: 1, end: 2 }], removedRanges: [] }
      ]
    };

    const entity = await commitToEntity(commit, diff, dummyRepo, false, 'owner/repo');

    expect(entity.hash).toBe(commit.hash);
    expect(entity.message).toBe(commit.message);
    expect(entity.repoName).toBe('owner/repo');
    expect(entity.files?.length).toBe(1);
    expect(entity.files?.[0].path).toBe('src/feature.js');
    expect(entity.functions?.length).toBe(1);
    expect(entity.functions?.[0].name).toBe('affectedFunction');
    expect(entity.bugs).toHaveLength(0);
    expect(entity.fixes).toHaveLength(0);
  });

  it('should detect a bug fix and create related entities', async () => {
    const commit: CommitLogEntry = {
      hash: 'f9e8d7c6b5a4',
      message: 'fix: resolve null pointer exception in auth service',
      author: 'Bob',
      timestamp: Date.now()
    };
    
    const diff: DiffResult = {
      commitHash: commit.hash,
      files: [
        { file: 'src/auth.js', addedRanges: [{ start: 1, end: 1 }], removedRanges: [{ start: 2, end: 2 }] }
      ]
    };

    const entity = await commitToEntity(commit, diff, dummyRepo);

    expect(entity.bugs).toHaveLength(1);
    expect(entity.fixes).toHaveLength(1);
    
    // Check that it extracted the description correctly
    expect(entity.bugs?.[0].description).toBe('Resolve null pointer exception in auth service');
    
    // Check fix linking
    expect(entity.fixes?.[0].commitHash).toBe(commit.hash);
    expect(entity.fixes?.[0].resolvesBug).toBe(entity.bugs?.[0]);
  });

  it('should gracefully handle a merge commit with no meaningful file changes (or skipped files)', async () => {
    const commit: CommitLogEntry = {
      hash: 'm1e2r3g4e5',
      message: 'Merge pull request #123 from branch',
      author: 'Charlie',
      timestamp: Date.now()
    };
    
    // Suppose it touched a deleted file and a massive file
    const diff: DiffResult = {
      commitHash: commit.hash,
      files: [
        { file: 'deleted.js', addedRanges: [], removedRanges: [{ start: 1, end: 10 }] },
        { file: 'huge.js', addedRanges: [{ start: 1, end: 2 }], removedRanges: [] }
      ]
    };

    const entity = await commitToEntity(commit, diff, dummyRepo);

    // Should not crash, and should have files mapped but 0 functions (since one threw, and one was skipped for size)
    expect(entity.files).toHaveLength(2);
    expect(entity.functions).toHaveLength(0);
    expect(entity.bugs).toHaveLength(0);
  });

  it('should skip function mapping if fastMode is enabled', async () => {
    const commit: CommitLogEntry = {
      hash: 'f1a2s3t4m5',
      message: 'chore: update docs',
      author: 'Diana',
      timestamp: Date.now()
    };
    
    const diff: DiffResult = {
      commitHash: commit.hash,
      files: [
        { file: 'src/index.js', addedRanges: [{ start: 1, end: 1 }], removedRanges: [] }
      ]
    };

    const entity = await commitToEntity(commit, diff, dummyRepo, true); // fastMode = true

    expect(entity.files).toHaveLength(1);
    expect(entity.functions).toHaveLength(0); // Bypassed
  });
});
