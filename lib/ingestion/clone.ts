import { simpleGit, SimpleGit } from 'simple-git';
import { existsSync } from 'fs';
import { logger } from './logger';
import { join } from 'path';

/**
 * Shallow-clones a GitHub repository to a local destination directory.
 * If the destination directory already exists and contains a git repository,
 * it pulls the latest changes instead of re-cloning.
 *
 * @param githubUrl The URL of the GitHub repository.
 * @param destDir The local directory to clone the repository into.
 * @param depth The depth of the shallow clone (default: 100).
 */
export async function cloneRepo(githubUrl: string, destDir: string, depth: number = 100): Promise<void> {
  try {
    const isRepoExists = existsSync(destDir) && existsSync(join(destDir, '.git'));

    if (isRepoExists) {
      logger.info(`Repository already exists at ${destDir}. Pulling latest changes...`);
      const git: SimpleGit = simpleGit({ baseDir: destDir });
      
      // Fetch and pull latest changes
      await git.pull();
      logger.info(`Successfully pulled latest changes for ${destDir}`);
    } else {
      logger.info(`Cloning repository ${githubUrl} to ${destDir} with depth ${depth}...`);
      const git: SimpleGit = simpleGit();
      
      // Perform shallow clone
      await git.clone(githubUrl, destDir, ['--depth', depth.toString()]);
      logger.info(`Successfully cloned ${githubUrl} to ${destDir}`);
    }
  } catch (error: any) {
    logger.error(`Failed to clone or pull repository: ${githubUrl}`);
    logger.error(`Error details: ${error.message}`);
    throw new Error(`Git operation failed: ${error.message}`);
  }
}
