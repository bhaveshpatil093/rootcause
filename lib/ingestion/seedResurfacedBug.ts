import { simpleGit, SimpleGit } from 'simple-git';
import { join } from 'path';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { logger } from './logger';
import { getCommitLog, getCommitDiff } from './parseHistory';
import { commitToEntity } from './extractEntities';
import { pushCommitsToCognee } from './remember';
import { markFixAsReverted } from './markFixStatus';

/**
 * Creates a synthetic local Git repository with a guaranteed "resurfaced bug" scenario.
 * This is perfect for demoing the graph relationships without relying on real-world repositories.
 */
async function seedSyntheticRepo() {
  const repoPath = join(process.cwd(), 'tmp-repos', 'synthetic-demo');
  
  // Clean up any old runs
  try {
    rmSync(repoPath, { recursive: true, force: true });
  } catch (e) {}
  
  mkdirSync(repoPath, { recursive: true });
  
  const git: SimpleGit = simpleGit({ baseDir: repoPath });
  await git.init();

  // Set up local git config so commits don't fail in headless environments
  await git.addConfig('user.name', 'Demo User');
  await git.addConfig('user.email', 'demo@rootcause.local');

  logger.info(`[SyntheticDemo] Initializing repo at ${repoPath}`);

  // 1. Initial State
  const filePath = join(repoPath, 'calculator.ts');
  let code = `export function divide(a: number, b: number) {
  return a / b;
}`;
  writeFileSync(filePath, code);
  await git.add('calculator.ts');
  await git.commit('feat: initial calculator implementation');

  // 2. The Bug Fix
  code = `export function divide(a: number, b: number) {
  if (b === 0) throw new Error("Divide by zero");
  return a / b;
}`;
  writeFileSync(filePath, code);
  await git.add('calculator.ts');
  const fixCommit = await git.commit('fix: resolve divide by zero crash in calculator');
  logger.info(`[SyntheticDemo] Created FIX commit: ${fixCommit.commit}`);

  // 3. The Resurfaced Bug (Regression)
  code = `export function divide(a: number, b: number) {
  // Optimized for speed
  return a / b;
}`;
  writeFileSync(filePath, code);
  await git.add('calculator.ts');
  const regressionCommit = await git.commit('refactor: optimize calculator for speed');
  logger.info(`[SyntheticDemo] Created REGRESSION commit: ${regressionCommit.commit}`);

  // --- Ingest the Synthetic Repo ---
  logger.info(`[SyntheticDemo] Starting ingestion of synthetic repo...`);
  const logs = await getCommitLog(repoPath);
  
  const entities = [];
  for (const log of logs) {
    const diff = await getCommitDiff(repoPath, log.hash);
    const entity = await commitToEntity(log, diff, repoPath);
    entities.push(entity);
  }

  // Push the commits to Cognee memory
  logger.info(`[SyntheticDemo] Pushing synthetic commits to Cognee...`);
  // NOTE: This will fail if LLM_API_KEY is missing, but the script is ready for when it's configured.
  try {
    await pushCommitsToCognee(entities, 'synthetic-demo-dataset');
    
    // Explicitly mark the fix as reverted because the bug resurfaced!
    await markFixAsReverted(fixCommit.commit, "Regression caused by speed optimization refactor");
    
    logger.info(`[SyntheticDemo] Successfully seeded and ingested the resurfaced bug scenario!`);
  } catch (error: any) {
    logger.warn(`[SyntheticDemo] Ingestion failed (likely due to missing LLM_API_KEY). Setup complete otherwise!`);
  }
}

// Execute if run directly
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  seedSyntheticRepo()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
