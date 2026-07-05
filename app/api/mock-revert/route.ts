import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { markFixAsReverted } = await import(
      "../../../lib/ingestion/markFixStatus"
    );

    const { commitHash, reason } = await request.json();

    if (!commitHash) {
      return NextResponse.json(
        { error: "commitHash required" },
        { status: 400 }
      );
    }

    await markFixAsReverted(
      commitHash,
      reason || "Marked as reverted via mock API"
    );

    return NextResponse.json({
      success: true,
    });

  } catch (err: any) {
    return NextResponse.json(
      {
        error: err.message,
      },
      {
        status: 500,
      }
    );
  }
}