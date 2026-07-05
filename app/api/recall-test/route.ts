import { NextResponse } from 'next/server';
import { logger } from '../../../lib/ingestion/logger';

export async function GET(request: Request) {
  try {

    const url = new URL(request.url);
    const query = url.searchParams.get('q') || "what functions were touched in the last week";

    logger.info(`[Recall Test] Querying: "${query}"`);

    const { cognee } = await import(
      "../../../lib/ingestion/cogneeClient"
    );

    // Attempt to recall from the memory engine
    const answer = await cognee.recall(query);

    return NextResponse.json({
      query,
      answer,
    });
  } catch (error: any) {
    logger.error('Recall test failed:', error);
    return NextResponse.json(
      { error: 'Recall test failed', details: error.message },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";