# Live Demo Fallback Guide

If the live ingestion step during the presentation fails due to conference Wi-Fi, GitHub API rate limits, or NVIDIA Nim timeouts, you can gracefully fallback to the pre-ingested Axios data without missing a beat.

## Pre-ingested Data

The `axios/axios` repository has been fully pre-ingested into your local `.cognee_system` database.

If you need to skip the ingestion UI and go straight to questioning the system about Axios bugs, follow these steps:

### 1. Get the pre-ingested Dataset Names
Run the following command in a new terminal tab to retrieve the exact IDs for the Axios batches:
```bash
curl -s http://localhost:3000/api/datasets | grep -o 'commits-c9b6b789d61785dbe171a3a6d828513e[^"]*'
```
*(This looks for datasets starting with the md5 hash of the Axios GitHub URL)*

### 2. Override the UI State
In your code editor, open `app/page.tsx` and temporarily hardcode the `activeDatasets` state on **line 60**:

```typescript
// Replace this:
const [activeDatasets, setActiveDatasets] = useState<string[]>([]);

// With the datasets you got from step 1 (you may have batch-0, batch-1, batch-2):
const [activeDatasets, setActiveDatasets] = useState<string[]>([
  "commits-c9b6b789d61785dbe171a3a6d828513e-1783185069065-batch-0",
  "commits-c9b6b789d61785dbe171a3a6d828513e-1783185069065-batch-1",
  "commits-c9b6b789d61785dbe171a3a6d828513e-1783185069065-batch-2"
]);
```

### 3. Ask your Questions
Save the file. Next.js will hot-reload. 
You can now immediately start typing questions into the Investigation search box on the web interface. The `/api/recall` endpoint will query the pre-ingested Axios graph directly, completely bypassing the failed ingestion step.

*Tip: Good demo questions for Axios include: "Why did the abort controller bug happen?" or "Has the network timeout bug resurfaced before?"*
