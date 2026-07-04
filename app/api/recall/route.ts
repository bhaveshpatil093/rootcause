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

    const result = await askRootCause(question, {
      datasetNames: Array.isArray(datasetNames) && datasetNames.length > 0 ? datasetNames : undefined,
    });
    const answer =
      result?.result?.kind === 'Text'
        ? result.result.data
        : 'No answer could be generated for this question.';
    return NextResponse.json({ question, answer });
  } catch (error: any) {
    console.error('Recall failed:', error);
    return NextResponse.json(
      { error: 'Recall failed', details: error.message },
      { status: 500 }
    );
  }
}