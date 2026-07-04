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

    const augmentedQuestion = `
You are an expert debugging assistant with access to a knowledge graph of commit history, fixes, and bug relationships.
Please answer the user's question by citing specific commits.
Pay close attention to [RELATION: RESOLVES_BUG], [RELATION: IS_RELATED_TO], and CORRECTION notes indicating if a fix held or resurfaced.

Output your response strictly as a JSON object matching this structure:
{
  "answer": "Your detailed analysis here...",
  "verdict": "RESOLVED" | "RESURFACED" | "UNKNOWN",
  "relatedCommits": ["commitHash1", "commitHash2"]
}

Verdict Rules:
- "RESURFACED": if the graph indicates that a Fix did NOT hold, or a bug was fixed but reappeared in a later commit, or a correction note says it was superseded.
- "RESOLVED": if the graph shows the bug was fixed and there is no record of it resurfacing.
- "UNKNOWN": if there is no prior record of this bug at all or it's unclear.

User Question: ${question}
`;

    const timeoutPromise = new Promise<any>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out after 15 seconds. The knowledge graph may be overloaded.')), 15000)
    );

    const recallPromise = askRootCause(augmentedQuestion, {
      datasetNames: Array.isArray(datasetNames) && datasetNames.length > 0 ? datasetNames : undefined,
    });

    const result = await Promise.race([recallPromise, timeoutPromise]);
    const rawAnswer = result?.result?.kind === 'Text' ? result.result.data : null;

    if (!rawAnswer) {
      return NextResponse.json({ question, answer: 'No answer could be generated.', verdict: 'UNKNOWN', relatedCommits: [] });
    }

    try {
      const jsonMatch = rawAnswer.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json({
          question,
          answer: parsed.answer || rawAnswer,
          verdict: parsed.verdict || 'UNKNOWN',
          relatedCommits: parsed.relatedCommits || []
        });
      }
    } catch (e) {
      console.warn("Failed to parse LLM JSON:", e);
    }
    
    return NextResponse.json({ question, answer: rawAnswer, verdict: 'UNKNOWN', relatedCommits: [] });
  } catch (error: any) {
    console.error('Recall failed:', error);
    return NextResponse.json(
      { error: 'Recall failed. Please try again.' },
      { status: 500 }
    );
  }
}