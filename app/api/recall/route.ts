import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {

    const { askRootCause } = await import(
      "../../../lib/recall/queryBuilder"
    );

    const body = await request.json();

    const { question, datasetNames } = body;


    if (!question || typeof question !== "string") {
      return NextResponse.json(
        {
          error: "question is required and must be a string"
        },
        {
          status: 400
        }
      );
    }


    const augmentedQuestion = `
You are an expert debugging assistant with access to a knowledge graph of commit history, fixes, and bug relationships.

Please answer the user's question by citing specific commits.

Pay close attention to:
[RELATION: RESOLVES_BUG]
[RELATION: IS_RELATED_TO]
CORRECTION notes.

Return JSON only:

{
 "answer": "",
 "verdict": "RESOLVED | RESURFACED | UNKNOWN",
 "relatedCommits": []
}


User Question:
${question}
`;



    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Request timed out after 15 seconds"
            )
          ),
        15000
      )
    );


    const recallPromise = askRootCause(
      augmentedQuestion,
      {
        datasetNames:
          Array.isArray(datasetNames) &&
            datasetNames.length > 0
            ? datasetNames
            : undefined,
      }
    );


    const result: any = await Promise.race([
      recallPromise,
      timeoutPromise,
    ]);



    const rawAnswer =
      result?.result?.kind === "Text"
        ? result.result.data
        : null;



    if (!rawAnswer) {
      return NextResponse.json({
        question,
        answer: "No answer generated.",
        verdict: "UNKNOWN",
        relatedCommits: [],
      });
    }


    try {
      const jsonMatch =
        rawAnswer.match(/\{[\s\S]*\}/);

      if (jsonMatch) {

        const parsed =
          JSON.parse(jsonMatch[0]);


        return NextResponse.json({
          question,
          answer:
            parsed.answer || rawAnswer,
          verdict:
            parsed.verdict || "UNKNOWN",
          relatedCommits:
            parsed.relatedCommits || [],
        });
      }

    } catch (e) {
      console.warn(
        "Failed parsing LLM JSON",
        e
      );
    }



    return NextResponse.json({
      question,
      answer: rawAnswer,
      verdict: "UNKNOWN",
      relatedCommits: [],
    });


  } catch (error: any) {

    console.error(
      "Recall failed:",
      error
    );


    return NextResponse.json(
      {
        error:
          "Recall failed. Please try again."
      },
      {
        status: 500
      }
    );
  }
}