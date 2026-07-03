import { NextResponse } from 'next/server';
import { Cognee } from '@cognee/cognee-ts';

export async function GET(request: Request) {
  try {
    const cognee = new Cognee();
    
    const query = "what commits touched cache.ts";
    console.log(`[Recall Test] Querying: "${query}"`);
    
    // Attempt to recall from the memory engine
    const answer = await cognee.recall(query);

    return NextResponse.json({
      query,
      answer,
    });
  } catch (error: any) {
    console.error('Recall test failed:', error);
    return NextResponse.json(
      { error: 'Recall test failed', details: error.message },
      { status: 500 }
    );
  }
}
