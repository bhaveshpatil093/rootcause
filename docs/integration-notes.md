# RootCause Integration & Architecture Notes

This document serves as the single source of truth for how the RootCause architecture currently operates end-to-end as of the final Phase D integration. It describes how data flows from a user providing a GitHub URL all the way to a verdict stamp rendering in the UI.

## 1. Ingestion Job Flow (Async Architecture)

To support massive repositories without Vercel/Next.js HTTP timeouts, the ingestion pipeline is fully asynchronous.

1. **Trigger (`POST /api/ingest`)**:
   - The UI submits a GitHub URL.
   - The route creates a unique `jobId`, adds it to the in-memory `jobStore`, and kicks off `runIngestionJob` in the background (fire-and-forget).
   - Immediately returns HTTP 202 with `{ jobId }`.
2. **Background Processing**:
   - Clones the repository to `/tmp/rootcause-repos/`.
   - Parses the git history using standard git commands.
   - Extracts semantic entities using an LLM (`extractEntities.ts`).
   - Pushes the entities to the Cognee knowledge graph in batches.
   - Updates the job store status and progress iteratively.
3. **Polling (`GET /api/ingest/status/[jobId]`)**:
   - The UI (`app/page.tsx`) polls this endpoint every 2 seconds.
   - It updates a visual progress bar (e.g. "Extracting AST and bug entities... 15 / 30").
   - Once the status hits `completed`, the polling stops, and the UI unlocks the investigation UI, setting the `activeDatasets` state.

## 2. Dataset Naming Scheme

Because Cognee stores everything globally by default, we isolate each repository analysis into uniquely named datasets to prevent cross-contamination (e.g. React bugs answering Axios questions).

- **Format**: `commits-{repoHash}-{timestamp}-batch-{index}`
- **Example**: `commits-c9b6b789d61785dbe171a3a6d828513e-1783185069065-batch-0`
- **Batching**: Datasets are pushed in batches of 10 commits to avoid timeouts and payload size limits when communicating with the LadybugDB/LanceDB graph instance.

## 3. Entity Schema

During the ingestion phase, we parse git diffs into a strict hierarchy of semantic entities that are injected into the Cognee graph as text documents. Cognee's internal `cognify` pipeline then extracts the graph edges.

1. **Commit**: The root entity (hash, author, date, message).
2. **File**: Linked to the Commit.
3. **Function**: Extracted via AST parsing (Regex/fallback). Linked to the File.
4. **Bug**: Derived via LLM analysis of the diff. Represents the root cause of an issue.
5. **Fix**: Derived via LLM analysis. Contains a critical `held: boolean` flag indicating if the fix survived or was reverted/regressed.

The LLM explicitly emits relationships in the text descriptions (e.g. `[RELATION: RESOLVES_BUG]` and `[RELATION: IS_RELATED_TO]`) so the vector graph explicitly draws those edges.

## 4. Recall Scoping

When a user asks a question in the UI:
1. `app/page.tsx` passes the query AND the exact `activeDatasets` array returned by the ingestion job to `POST /api/recall`.
2. `queryBuilder.ts` looks up the internal Cognee dataset IDs for those exact names.
3. If no matching datasets exist, it strictly throws an error rather than silently defaulting to a global, unscoped search.
4. `cognee.search()` is executed using *only* those dataset IDs.

## 5. Verdict Stamp Derivation

The "RESOLVED / RESURFACED / NO PRIOR RECORD" stamp in the UI is fully data-driven based on the graph traversal, not a frontend heuristic.

1. **The Prompt**: Before sending the query to the LLM, `/api/recall` wraps the user's question in a strict system prompt. The prompt instructs the LLM to analyze the retrieved graph relationships (`RESOLVES_BUG`, `IS_RELATED_TO`, and `CORRECTION` notes).
2. **The Output**: The LLM is forced to output a JSON object:
   ```json
   {
     "answer": "...",
     "verdict": "RESOLVED | RESURFACED | UNKNOWN",
     "relatedCommits": ["hash1", "hash2"]
   }
   ```
3. **The Rules**:
   - **RESURFACED**: The graph contains `held: false`, a fix was superseded, or a bug is linked to multiple fixes across time.
   - **RESOLVED**: A bug has a clear fix commit and no subsequent regressions.
   - **UNKNOWN**: The graph has no record of the issue.
4. **The UI**: The Next.js API parses the JSON and passes it to `app/page.tsx`, which maps the `verdict` field directly to the colored visual badge and renders the `relatedCommits` array.
