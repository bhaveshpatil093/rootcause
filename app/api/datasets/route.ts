import { NextResponse } from 'next/server';
import { cognee } from '../../../lib/ingestion/cogneeClient';

export async function GET() {
  try {
    const datasets = await cognee.datasets.list();
    return NextResponse.json({ datasets });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
