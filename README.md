# RootCause 🔍

RootCause is an AI-powered debugging assistant that acts as a corporate memory for your codebase. By analyzing your git history and automatically tracking bug fixes and regressions, RootCause helps developers understand *why* bugs happened, *when* they were fixed, and critically, *if* they've resurfaced.

## Documentation

For a detailed look at the architecture, schema, and live demo script, please read the following:
- 📖 [Integration & Architecture Notes](docs/integration-notes.md) - The single source of truth for how the system works end-to-end, detailing the async job flow, graph schema, and verdict logic.
- 🎤 [Live Demo Script](docs/demo-script.md) - The exact script and steps to use when presenting RootCause on stage.

## How it Works: The End-to-End Pipeline

The system combines an asynchronous React frontend, a Next.js API, and a local LanceDB graph powered by the `@cognee/cognee-ts` SDK.

1. **Async Ingestion (`POST /api/ingest`)**
   - The UI submits a GitHub repository URL. The backend immediately returns a `jobId` (HTTP 202) and clones the repository in the background.
   - The UI polls `/api/ingest/status/[jobId]` every 2 seconds to render a live progress bar.
2. **Entity Extraction (`extractEntities.ts`)**
   - We extract `Commit`, `File`, and `Function` nodes.
   - Using an LLM, we analyze diffs to construct semantic `Bug` and `Fix` entities. We explicitly track if a fix `held: boolean` to detect regressions.
3. **Graph Storage (`remember.ts`)**
   - Entities and their relationships (`RESOLVES_BUG`, `IS_RELATED_TO`) are batch-pushed into the **Cognee** knowledge graph.
   - Data is strictly scoped using unique Dataset Names (`commits-[hash]-[timestamp]`) to prevent cross-contamination between repositories.
4. **Structured Recall (`POST /api/recall`)**
   - When a user asks a debugging question via the UI, RootCause queries the exact scoped dataset in LanceDB.
   - Using a strict system prompt, the LLM analyzes the graph edges and outputs structured JSON containing an exact verdict (`RESOLVED`, `RESURFACED`, `UNKNOWN`) and cites the specific `relatedCommits`.
   - The UI safely parses this JSON to render the Investigation Verdict badge.

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure your environment variables:**
   ```bash
   cp .env.local.example .env.local
   ```
   Add your `NVIDIA_API_KEY` (or OpenAI equivalent) into `.env.local`.

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser.

## Testing & Demo Setup

### Preparing for the Demo
To pre-warm the database for the live demo and bypass any rate limits or conference Wi-Fi issues, run the pre-ingestion script:
```bash
npm run demo:prepare
```
*(This uses `scripts/final-demo.ts` to ingest `axios/axios` into the local LanceDB graph).*

### Local CLI Testing
You can interact with the graph directly from the terminal without the web UI:
```bash
npx tsx lib/recall/cli.ts
```
