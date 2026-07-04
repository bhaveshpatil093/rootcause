# RootCause

RootCause is an AI-powered debugging assistant that acts as a corporate memory for your codebase. By analyzing your git history and automatically tracking bug fixes and regressions, RootCause helps developers understand *why* bugs happened, *when* they were fixed, and *if* they've resurfaced.

## How it Works: The Ingestion Pipeline

The backend ingestion pipeline is the heart of RootCause. When you submit a GitHub repository for analysis, the pipeline orchestrates the following architecture to build a queryable knowledge graph.

### Architecture Flow

1. **Next.js API Route (`/api/ingest`)**
   - Receives the repository URL and kicks off an asynchronous background job.
   - Returns a Job ID to the frontend, allowing the client to poll `/api/ingest/status/[jobId]` for real-time progress updates.
   
2. **Git Parsing (`lib/ingestion/parseHistory.ts`)**
   - Shallow clones the target repository using `simple-git`.
   - Extracts the commit log and parses the raw string diffs of each commit to understand what code was touched.
   
3. **Entity Extraction (`lib/ingestion/extractEntities.ts`)**
   - Parses the diff to map which functions were modified.
   - Uses an LLM (`detectFixes`) to analyze the commit message and diff. It determines if the commit was a FIX, and if so, extracts the specific `Bug` entity that was resolved.
   
4. **Knowledge Graph Insertion (`lib/ingestion/remember.ts`)**
   - The structured data (Commits, Bugs, Files, and Functions) is pushed into **Cognee** via the `@cognee/cognee-ts` SDK.
   - Cognee translates these TypeScript objects into nodes and edges, permanently recording the semantic history of the codebase into a local LanceDB instance.

### Graph vs. Vector Search: The Secret Sauce

RootCause relies heavily on **Cognee** to manage its memory. To accurately answer complex debugging queries (like "Has this bug resurfaced?"), we combine the strengths of both Vector and Graph databases:

* **Vector Search (The Entry Point):** When a user asks a question in natural language (e.g., *"Why is the auth token timing out?"*), we use vector embeddings to semantically match their question to a node in the database. Vector search is excellent for fuzzy matching and understanding intent, allowing us to locate the specific `Bug` node related to auth tokens.
* **Graph Traversal (The Truth):** Once we locate the node via Vector search, we switch to Graph traversal. Graph databases use deterministic edges, meaning we can traverse relationships with 100% accuracy and zero LLM hallucination. We traverse the `FIXED_BY` edge to find the commit that fixed it, the `TOUCHES` edge to see which functions were altered, and the `REVERTED_BY` edge to determine if the fix was later undone, perfectly answering the user's question.

## Getting Started

First, install dependencies:
```bash
npm install
```

Configure your environment variables:
```bash
cp .env.local.example .env.local
# Add your NVIDIA Nim (or OpenAI) API keys
```

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Testing & Demoing

To run a fast, end-to-end synthetic demo of the ingestion pipeline without relying on external repos or network limits:
```bash
npm run ingest:test
```
