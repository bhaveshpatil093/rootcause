import { cloneRepo } from './clone';
import { getCommitLog, getCommitDiff } from './parseHistory';
import { commitToEntity } from './extractEntities';
import { join } from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';

async function runBenchmark(repoUrl: string, maxCommits: number, fastMode: boolean): Promise<number> {
  const repoHash = crypto.createHash('md5').update(repoUrl).digest('hex');
  const destDir = join(tmpdir(), 'rootcause-benchmark', repoHash);
  
  const startClone = performance.now();
  await cloneRepo(repoUrl, destDir, maxCommits + 50);
  const endClone = performance.now();
  
  const logs = await getCommitLog(destDir);
  const commitsToProcess = logs.slice(0, maxCommits);
  
  const urlParts = repoUrl.replace(/\/$/, '').split('/');
  const repoName = urlParts.length >= 2 ? `${urlParts[urlParts.length - 2]}/${urlParts[urlParts.length - 1]}`.replace('.git', '') : repoUrl;

  const startExtraction = performance.now();
  for (const rawCommit of commitsToProcess) {
    const diff = await getCommitDiff(destDir, rawCommit.hash);
    await commitToEntity(rawCommit, diff, destDir, fastMode, repoName);
  }
  const endExtraction = performance.now();

  return (endExtraction - startExtraction); // returns MS for extraction
}

async function main() {
  const repos = [
    'https://github.com/bhaveshpatil093/rootcause',
    'https://github.com/tj/commander.js.git'
  ];
  const maxCommits = 100;

  console.log(`Starting benchmark for maxCommits=${maxCommits}...\n`);

  for (const repo of repos) {
    console.log(`Repo: ${repo}`);
    
    // FastMode = false
    const msNormal = await runBenchmark(repo, maxCommits, false);
    console.log(`  - fastMode=false (AST mapping): ${(msNormal / 1000).toFixed(2)}s`);
    
    // FastMode = true
    const msFast = await runBenchmark(repo, maxCommits, true);
    console.log(`  - fastMode=true (Skip mapping): ${(msFast / 1000).toFixed(2)}s`);
    
    console.log(`  -> Speedup: ${(msNormal / msFast).toFixed(2)}x faster\n`);
  }
}

main().catch(console.error);
