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
import { createJob, updateJob, jobStore } from '../../../lib/ingestion/jobStore';
import { calculateStats } from '../../../lib/ingestion/stats';

async function runIngestionJob(jobId: string, githubUrl: string, maxCommits: number, fastMode: boolean, dryRun: boolean) {
  const repoHash = crypto.createHash('md5').update(githubUrl).digest('hex');
  const reposBaseDir = join(tmpdir(), 'rootcause-repos');
  const destDir = join(reposBaseDir, repoHash);
  
  try {
    updateJob(jobId, { status: 'processing', message: `Cloning repository...` });
    mkdirSync(reposBaseDir, { recursive: true });
    
    // Clone with a slight buffer in depth
    await cloneRepo(githubUrl, destDir, maxCommits + 10); 

    updateJob(jobId, { message: `Parsing git history...` });
    const logs = await getCommitLog(destDir);
    const commitsToProcess = logs.slice(0, maxCommits);
    const entities: Commit[] = [];
    const errors: string[] = [];

    // Extract repo name from URL (e.g. https://github.com/owner/repo -> owner/repo)
    const urlParts = githubUrl.replace(/\/$/, '').split('/');
    const repoName = urlParts.length >= 2 ? `${urlParts[urlParts.length - 2]}/${urlParts[urlParts.length - 1]}`.replace('.git', '') : githubUrl;

    updateJob(jobId, { total: commitsToProcess.length, message: `Extracting entities from ${commitsToProcess.length} commits...` });

    for (let i = 0; i < commitsToProcess.length; i++) {
      const rawCommit = commitsToProcess[i];
      try {
        const diff = await getCommitDiff(destDir, rawCommit.hash);
        const entity = await commitToEntity(rawCommit, diff, destDir, fastMode, repoName);
        entities.push(entity);
      } catch (err: any) {
        logger.warn(`Error processing commit ${rawCommit.hash}:`, err);
        errors.push(`Commit ${rawCommit.hash}: ${err.message}`);
      }
      updateJob(jobId, { progress: i + 1, message: `Extracting AST and bug entities...` });
    }

    const stats = calculateStats(entities, errors);

    if (entities.length === 0) {
      updateJob(jobId, {
        status: 'failed',
        message: 'No data ingested (no valid commits found)',
        error: errors.length > 0 ? errors.join('; ') : 'Repository empty or no commits matching criteria',
        stats
      });
      return;
    }

    if (dryRun) {
      updateJob(jobId, {
        status: 'completed',
        message: 'Dry run complete (no data pushed to Cognee)',
        datasetNames: [],
        dryRunData: entities,
        stats,
        error: errors.length > 0 ? errors.join('; ') : undefined
      });
      return;
    }

    const datasetNames: string[] = [];
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < entities.length; i += BATCH_SIZE) {
      const batch = entities.slice(i, i + BATCH_SIZE);
      const datasetName = `commits-${repoHash}-${Date.now()}-batch-${i / BATCH_SIZE}`;
      
      updateJob(jobId, { message: `Pushing batch ${i / BATCH_SIZE + 1} to Cognee...` });
      logger.info(`Pushing batch ${i / BATCH_SIZE + 1} (${batch.length} commits) to Cognee dataset: ${datasetName}...`);
      
      await pushCommitsToCognee(batch, datasetName);
      datasetNames.push(datasetName);
      
      logger.info(`Batch ${i / BATCH_SIZE + 1} pushed successfully.`);
    }

    updateJob(jobId, { 
      status: 'completed', 
      message: 'Ingestion complete', 
      datasetNames,
      stats,
      error: errors.length > 0 ? errors.join('; ') : undefined
    });

  } catch (error: any) {
    logger.error(`Ingestion failed for job ${jobId}:`, error);
    updateJob(jobId, { status: 'failed', message: 'Ingestion process failed', error: error.message });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { githubUrl, maxCommits = 30, fastMode = false, dryRun = false } = body;

    if (!githubUrl || typeof githubUrl !== 'string') {
      return NextResponse.json(
        { error: 'githubUrl is required and must be a string' },
        { status: 400 }
      );
    }

    const jobId = crypto.randomUUID();
    createJob(jobId, githubUrl, maxCommits);

    // Fire and forget
    runIngestionJob(jobId, githubUrl, maxCommits, fastMode, dryRun).catch(e => {
      logger.error('Unhandled background job error', e);
    });

    return NextResponse.json({
      message: 'Ingestion job started',
      jobId,
    }, { status: 202 });

  } catch (error: any) {
    logger.error('Ingestion failed to start:', error);
    return NextResponse.json(
      { error: 'Failed to start ingestion', details: error.message },
      { status: 500 }
    );
  }
}
