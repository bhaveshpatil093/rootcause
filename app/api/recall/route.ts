import { NextResponse } from 'next/server';
import { askRootCause } from '../../../lib/recall/queryBuilder';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { question, datasetNames } = body;
    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'question is required and must be a string' },
        { status: 400 }
      );
    }

    const timeoutPromise = new Promise<any>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out after 15 seconds. The knowledge graph may be overloaded.')), 15000)
    );

    const recallPromise = askRootCause(question, {
      datasetNames: Array.isArray(datasetNames) && datasetNames.length > 0 ? datasetNames : undefined,
    });

    const result = await Promise.race([recallPromise, timeoutPromise]);
    const answer =
      result?.result?.kind === 'Text'
        ? result.result.data
        : 'No answer could be generated for this question.';
    return NextResponse.json({ question, answer });
  } catch (error: any) {
    console.error('Recall failed:', error);
    return NextResponse.json(
      { error: 'Recall failed. Please try again.' },
      { status: 500 }
    );
  }
}