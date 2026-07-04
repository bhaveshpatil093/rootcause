# Ingestion Engine Documentation

The Ingestion Engine is responsible for deeply analyzing a GitHub repository, parsing its Git history, running AST analysis to map line changes to function boundaries, detecting bug fixes via heuristics, and pushing the structured relationships into the Cognee Knowledge Graph.

Due to the heavy nature of these operations and the strict timeouts enforced by serverless Next.js hosting, the ingestion pipeline utilizes a completely asynchronous **Background Job Architecture**.

---

## 1. Kick-off Ingestion
**Endpoint**: `POST /api/ingest`

Initiates an ingestion job and returns a `jobId` immediately.

### Request Body (JSON)

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `githubUrl` | `string` | **Required** | The HTTPS URL of the Git repository to analyze (e.g., `https://github.com/owner/repo`). |
| `maxCommits` | `number` | `30` | The maximum number of recent commits to analyze. |
| `fastMode` | `boolean` | `false` | If `true`, completely skips file content fetching and AST function mapping. Use this for drastically faster processing when only file-level relationships matter. |
| `dryRun` | `boolean` | `false` | If `true`, executes the entire pipeline (cloning, diffing, AST mapping) but skips the final network call to `pushCommitsToCognee()`. The generated entities are instead attached to the job status response. Excellent for debugging. |

### Example Request
```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "githubUrl": "https://github.com/tj/commander.js",
    "maxCommits": 100,
    "fastMode": false,
    "dryRun": false
  }'
```

### Example Response (202 Accepted)
```json
{
  "message": "Ingestion job started",
  "jobId": "f4b3a8c1-9d2a-4c8d-b3f9-7e1f3a2c5b8a"
}
```

---

## 2. Poll Job Status
**Endpoint**: `GET /api/ingest/status/[jobId]`

Fetches the live snapshot of an active or completed ingestion job. The frontend should poll this endpoint (e.g., every 2 seconds) until `status` becomes `completed` or `failed`.

### Example Request
```bash
curl http://localhost:3000/api/ingest/status/f4b3a8c1-9d2a-4c8d-b3f9-7e1f3a2c5b8a
```

### Example Response (Processing)
```json
{
  "id": "f4b3a8c1-9d2a-4c8d-b3f9-7e1f3a2c5b8a",
  "repoUrl": "https://github.com/tj/commander.js",
  "status": "processing",
  "message": "Extracted entities (42/100)",
  "progress": 42,
  "total": 100,
  "datasetNames": []
}
```

### Example Response (Completed)
```json
{
  "id": "f4b3a8c1-9d2a-4c8d-b3f9-7e1f3a2c5b8a",
  "repoUrl": "https://github.com/tj/commander.js",
  "status": "completed",
  "message": "Ingestion complete",
  "progress": 100,
  "total": 100,
  "datasetNames": [
    "commits-7204a020d1b86af2869b19a9ce0d40e6-1720231945-batch-0",
    "commits-7204a020d1b86af2869b19a9ce0d40e6-1720231946-batch-1"
  ],
  "stats": {
    "totalCommits": 100,
    "fixCommitsDetected": 4,
    "functionsMapped": 411,
    "skippedOrFailedCommits": 0
  }
}
```
*(Note: If `dryRun: true` was passed, this payload will also contain a `dryRunData` array containing the raw JSON representations of every entity that would have been pushed to Cognee).*

---

## State Architecture Limitations (MVP Note)
For this MVP, the `jobStore` state is kept in an in-memory `global` Map (see `lib/ingestion/jobStore.ts`). 
- This requires zero dependencies (no Redis needed).
- **Caveat:** In a local Next.js development environment (`npm run dev`), Next.js aggressively hot-reloads the server on file changes. If you save a file during an active ingestion, the server restarts, and the in-memory Map will wipe, causing polling requests to return a `404 Job not found`. This is not an issue in production builds (`npm run build && npm run start`).
