import { NextResponse } from 'next/server';
import { Commit } from '../../../lib/ingestion/schema';
import { cloneRepo } from '../../../lib/ingestion/clone';
import { getCommitLog, getCommitDiff } from '../../../lib/ingestion/parseHistory';
import { commitToEntity } from '../../../lib/ingestion/extractEntities';
import { pushCommitsToCognee } from '../../../lib/ingestion/remember';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync } from 'fs';
import crypto from 'crypto';
import { logger } from '../../../lib/ingestion/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { githubUrl, maxCommits = 30, fastMode = false } = body;

    if (!githubUrl || typeof githubUrl !== 'string') {
      return NextResponse.json(
        { error: 'githubUrl is required and must be a string' },
        { status: 400 }
      );
    }

    // Generate a unique directory name for the clone using the system temp directory
    const repoHash = crypto.createHash('md5').update(githubUrl).digest('hex');
    const reposBaseDir = join(tmpdir(), 'rootcause-repos');
    const destDir = join(reposBaseDir, repoHash);
    
    // Ensure parent dir exists
    mkdirSync(reposBaseDir, { recursive: true });

    logger.info(`Starting ingestion for ${githubUrl} into ${destDir} (maxCommits: ${maxCommits}, fastMode: ${fastMode})`);
    
    // Clone with a slight buffer in depth
    await cloneRepo(githubUrl, destDir, maxCommits + 10); 

    const logs = await getCommitLog(destDir);
    const commitsToProcess = logs.slice(0, maxCommits);
    const entities: Commit[] = [];
    const errors: string[] = [];

    // Extract repo name from URL (e.g. https://github.com/owner/repo -> owner/repo)
    const urlParts = githubUrl.replace(/\/$/, '').split('/');
    const repoName = urlParts.length >= 2 ? `${urlParts[urlParts.length - 2]}/${urlParts[urlParts.length - 1]}`.replace('.git', '') : githubUrl;

    for (const rawCommit of commitsToProcess) {
      try {
        const diff = await getCommitDiff(destDir, rawCommit.hash);
        const entity = await commitToEntity(rawCommit, diff, destDir, fastMode, repoName);
        entities.push(entity);
      } catch (err: any) {
        logger.warn(`Error processing commit ${rawCommit.hash}:`, err);
        errors.push(`Commit ${rawCommit.hash}: ${err.message}`);
      }
    }

    // Push all successfully parsed commits to Cognee in batches of 10.
    // Batching is required — Cognee's cognify pipeline short-circuits on
    // repeat remember() calls to an already-completed dataset.
    // We create unique dataset names per batch to avoid this short-circuit.
    const datasetNames: string[] = [];
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < entities.length; i += BATCH_SIZE) {
      const batch = entities.slice(i, i + BATCH_SIZE);
      const datasetName = `commits-${repoHash}-${Date.now()}-batch-${i / BATCH_SIZE}`;
      logger.info(`Pushing batch ${i / BATCH_SIZE + 1} (${batch.length} commits) to Cognee dataset: ${datasetName}...`);
      await pushCommitsToCognee(batch, datasetName);
      datasetNames.push(datasetName);
      logger.info(`Batch ${i / BATCH_SIZE + 1} pushed successfully.`);
    }

    return NextResponse.json({
      message: 'Ingestion complete',
      processedCommits: entities.length,
      errors: errors.length > 0 ? errors : undefined,
      repo: githubUrl,
      datasetNames: datasetNames
    });

  } catch (error: any) {
    logger.error('Ingestion failed:', error);
    return NextResponse.json(
      { error: 'Ingestion process failed', details: error.message },
      { status: 500 }
    );
  }
}
