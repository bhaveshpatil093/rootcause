import { NextResponse } from 'next/server';
import { cloneRepo } from '../../../lib/ingestion/clone';
import { getCommitLog, getCommitDiff } from '../../../lib/ingestion/parseHistory';
import { commitToEntity } from '../../../lib/ingestion/extractEntities';
import { pushCommitsToCognee } from '../../../lib/ingestion/remember';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync } from 'fs';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { githubUrl, maxCommits = 30 } = body;

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

    console.log(`Starting ingestion for ${githubUrl} into ${destDir}`);
    
    // Clone with a slight buffer in depth
    await cloneRepo(githubUrl, destDir, maxCommits + 10); 

    const logs = await getCommitLog(destDir);
    const commitsToProcess = logs.slice(0, maxCommits);
    const entities: ReturnType<typeof commitToEntity>[] = [];
    const errors: string[] = [];

    for (const rawCommit of commitsToProcess) {
      try {
        const diff = await getCommitDiff(destDir, rawCommit.hash);
        const entity = commitToEntity(rawCommit, diff);
        entities.push(entity);
      } catch (err: any) {
        console.error(`Error processing commit ${rawCommit.hash}:`, err);
        errors.push(`Commit ${rawCommit.hash}: ${err.message}`);
      }
    }

    // Push all successfully parsed commits to Cognee in a single batch call.
    // Batching is required — Cognee's cognify pipeline short-circuits on
    // repeat remember() calls to an already-completed dataset, so calling
    // it once per commit would silently skip graph extraction for all but
    // the first commit.
    let processedCount = 0;
    const datasetName = `commits-${repoHash}-${Date.now()}`;
    if (entities.length > 0) {
      await pushCommitsToCognee(entities, datasetName);
      processedCount = entities.length;
    }

    return NextResponse.json({
      message: 'Ingestion complete',
      processedCommits: processedCount,
      errors: errors.length > 0 ? errors : undefined,
      repo: githubUrl,
      datasetName: datasetName
    });

  } catch (error: any) {
    console.error('Ingestion failed:', error);
    return NextResponse.json(
      { error: 'Ingestion process failed', details: error.message },
      { status: 500 }
    );
  }
}
