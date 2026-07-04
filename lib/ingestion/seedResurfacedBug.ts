import 'dotenv/config';
import { simpleGit, SimpleGit } from 'simple-git';
import { join } from 'path';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { logger } from './logger';

async function seedSyntheticRepo() {
  const repoPath = join(process.cwd(), 'tmp-repos', 'synthetic-demo');
  const cachedRepoPath = join(require('os').tmpdir(), 'rootcause-repos', require('crypto').createHash('md5').update(repoPath).digest('hex'));
  
  // Clean up any old runs
  try {
    rmSync(repoPath, { recursive: true, force: true });
    rmSync(cachedRepoPath, { recursive: true, force: true });
  } catch (e) {}
  
  mkdirSync(repoPath, { recursive: true });
  
  const git: SimpleGit = simpleGit({ baseDir: repoPath });
  await git.init();

  await git.addConfig('user.name', 'Demo User');
  await git.addConfig('user.email', 'demo@rootcause.local');

  logger.info(`[SyntheticDemo] Initializing repo at ${repoPath}`);

  // 1. Initial State
  const filePath = join(repoPath, 'calculator.ts');
  let code = `export function divide(a: number, b: number) {\n  return a / b;\n}`;
  writeFileSync(filePath, code);
  await git.add('calculator.ts');
  await git.commit('feat: initial calculator implementation');

  // 2. The Bug Fix
  code = `export function divide(a: number, b: number) {\n  if (b === 0) throw new Error("Divide by zero");\n  return a / b;\n}`;
  writeFileSync(filePath, code);
  await git.add('calculator.ts');
  const fixCommit = await git.commit('fix: resolve divide by zero crash in calculator');
  logger.info(`[SyntheticDemo] Created FIX commit: ${fixCommit.commit}`);

  // 3. The Resurfaced Bug (Regression)
  code = `export function divide(a: number, b: number) {\n  // Optimized for speed\n  return a / b;\n}`;
  writeFileSync(filePath, code);
  await git.add('calculator.ts');
  const regressionCommit = await git.commit('refactor: optimize calculator for speed');
  logger.info(`[SyntheticDemo] Created REGRESSION commit: ${regressionCommit.commit}`);

  return { repoPath, fixHash: fixCommit.commit, regressionHash: regressionCommit.commit };
}

async function runDemo() {
  const { repoPath, fixHash } = await seedSyntheticRepo();

  logger.info("\n--- Starting Ingestion via API ---");
  const ingestRes = await fetch('http://localhost:3000/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      githubUrl: repoPath, // Using local path directly
      maxCommits: 5,
      dryRun: false
    })
  });
  
  const ingestData = await ingestRes.json();
  const jobId = ingestData.jobId;
  logger.info(`Job ID: ${jobId}`);

  let datasetNames: string[] = [];
  
  while (true) {
    const statusRes = await fetch(`http://localhost:3000/api/ingest/status/${jobId}`);
    const statusData = await statusRes.json();
    logger.info(`Status: ${statusData.status} - ${statusData.message}`);
    
    if (statusData.status === 'completed') {
      datasetNames = statusData.datasetNames || [];
      logger.info("Ingestion Stats:", statusData.stats);
      break;
    } else if (statusData.status === 'failed') {
      logger.error("Ingestion failed:", statusData.error);
      return;
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  logger.info("\n--- Simulating Revert/Resurface via API marking ---");
  // The system usually detects this through LLM recall matching, but for deterministic demoing
  // we use our explicit utility just like before.
  await fetch('http://localhost:3000/api/mock-revert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commitHash: fixHash, reason: "Regression caused by speed optimization refactor" })
  });

  logger.info("\n--- Querying Recall API ---");
  const question = "Why did the calculator divide by zero crash happen, and has it been fixed?";
  logger.info(`Q: ${question}`);
  
  const recallRes = await fetch('http://localhost:3000/api/recall', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      datasetNames
    })
  });

  const recallData = await recallRes.json();
  logger.info(`\nA: ${recallData.answer}`);
}

runDemo().catch(err => logger.error("Demo run failed:", err));
