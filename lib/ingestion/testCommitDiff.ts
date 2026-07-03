import { cloneRepo } from './clone';
import { getCommitLog, getCommitDiff } from './parseHistory';
import { join } from 'path';
import { rmSync } from 'fs';

async function test() {
  const repoUrl = 'https://github.com/tj/commander.js.git';
  const destDir = join(process.cwd(), 'tmp-repos', 'commander.js');

  console.log(`--- Testing getCommitDiff against ${repoUrl} ---`);
  
  try {
    // 1. Clone the repo
    await cloneRepo(repoUrl, destDir, 10); 

    // 2. Get the commit log to find a commit hash
    const logs = await getCommitLog(destDir);
    if (logs.length === 0) {
      throw new Error('No commits found in the repository.');
    }
    
    // Pick the most recent commit
    const latestCommit = logs[0];
    console.log(`\nTesting diff for commit ${latestCommit.hash} (${latestCommit.message})`);

    // 3. Get the diff
    const diff = await getCommitDiff(destDir, latestCommit.hash);
    
    // 4. Log the result
    console.log(`\nDiff result:`);
    console.log(JSON.stringify(diff, null, 2));

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up
    console.log('\nCleaning up tmp-repos...');
    try {
      rmSync(join(process.cwd(), 'tmp-repos'), { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  }
}

test();
