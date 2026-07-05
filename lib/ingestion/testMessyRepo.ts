import { cloneRepo } from './clone';
import { getCommitLog, getCommitDiff } from './parseHistory';
import { commitToEntity } from './extractEntities';
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs';

async function testMessyRepo() {
  const repoUrl = 'https://github.com/tj/commander.js.git';
  const destDir = join(tmpdir(), 'commander.js-messy');

  console.log(`Cloning ${repoUrl} into ${destDir}...`);
  await cloneRepo(repoUrl, destDir, 100);

  const logs = await getCommitLog(destDir);
  console.log(`Fetched ${logs.length} commits.`);

  let totalFixes = 0;
  let totalFiles = 0;
  let totalFunctionsMapped = 0;
  
  const issues = [];

  for (const rawCommit of logs.slice(0, 100)) {
    try {
      const diff = await getCommitDiff(destDir, rawCommit.hash);
      const entity = await commitToEntity(rawCommit, diff, destDir, false, 'tj/commander.js');
      
      totalFiles += entity.files?.length || 0;
      totalFunctionsMapped += entity.functions?.length || 0;

      if (entity.fixes && entity.fixes.length > 0) {
        totalFixes++;
      }

      // Check for oddities
      if (entity.files && entity.files.length > 0 && (!entity.functions || entity.functions.length === 0)) {
        // Did we fail to map functions for a file that changed?
        const fileNames = entity.files.map(f => f.path);
        // Only flag if they are JS/TS files
        if (fileNames.some(f => f.endsWith('.js') || f.endsWith('.ts'))) {
          issues.push(`[WARN] Commit ${rawCommit.hash.substring(0, 7)}: Changed JS/TS files but mapped 0 functions. (Files: ${fileNames.join(', ')})`);
        }
      }

    } catch (err: any) {
      issues.push(`[ERROR] Commit ${rawCommit.hash.substring(0, 7)}: ${err.message}`);
    }
  }

  console.log('\n--- RESULTS ---');
  console.log(`Total Commits Evaluated: 100`);
  console.log(`Total Fixes Detected: ${totalFixes}`);
  console.log(`Total Files Touched: ${totalFiles}`);
  console.log(`Total Functions Mapped: ${totalFunctionsMapped}`);
  console.log(`\n--- ODDITIES / ISSUES ---`);
  issues.forEach(i => console.log(i));
  
  if (issues.length === 0) {
    console.log("No obvious oddities found.");
  }
}

testMessyRepo().catch(console.error);
