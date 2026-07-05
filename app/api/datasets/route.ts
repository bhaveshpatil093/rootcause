import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { cognee } = await import(
      "../../../lib/ingestion/cogneeClient"
    );

    const datasets = await cognee.datasets.list();

    return NextResponse.json({ datasets });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}