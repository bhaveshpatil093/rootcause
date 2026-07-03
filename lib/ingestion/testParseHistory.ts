import { cloneRepo } from './clone';
import { getCommitLog } from './parseHistory';
import { join } from 'path';
import { rmdirSync, rmSync } from 'fs';

async function test() {
  const repoUrl = 'https://github.com/tj/commander.js.git';
  const destDir = join(process.cwd(), 'tmp-repos', 'commander.js');

  console.log(`--- Testing getCommitLog against ${repoUrl} ---`);
  
  try {
    // 1. Clone the repo
    await cloneRepo(repoUrl, destDir, 20); // Get at least 20 commits

    // 2. Parse history
    const logs = await getCommitLog(destDir);
    
    // 3. Log first 10
    console.log(`\nSuccessfully retrieved ${logs.length} commits. First 10 results:`);
    console.log(JSON.stringify(logs.slice(0, 10), null, 2));

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
