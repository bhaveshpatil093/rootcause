import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(promptText: string): Promise<string> {
  return new Promise((resolve) => rl.question(promptText, resolve));
}

async function pollJob(jobId: string): Promise<string[]> {
  console.log("\nPolling for job completion...");
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/ingest/status/${jobId}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const job = await res.json();
        
        process.stdout.write(`\r[Status] ${job.message}`.padEnd(80));

        if (job.status === 'completed') {
          clearInterval(interval);
          console.log("\n\nIngestion complete!");
          resolve(job.datasetNames || []);
        } else if (job.status === 'failed') {
          clearInterval(interval);
          console.error(`\n\nIngestion failed: ${job.error || job.message}`);
          reject(new Error(job.error || job.message));
        }
      } catch (e: any) {
        // Keep polling on minor network errors
        process.stdout.write(`\r[Status] Polling error: ${e.message}`.padEnd(80));
      }
    }, 2000);
  });
}

async function main() {
  console.log("=== RootCause CLI ===");
  console.log("Ensure your Next.js dev server is running on http://localhost:3000\n");

  let activeDatasets: string[] = [];

  const repoUrl = await ask("Enter GitHub URL to ingest (or press enter to skip and query all datasets): ");
  
  if (repoUrl.trim()) {
    try {
      console.log(`\nStarting ingestion for ${repoUrl.trim()}...`);
      const res = await fetch('http://localhost:3000/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUrl: repoUrl.trim(), maxCommits: 5 }), // Keep it fast for CLI by default
      });
      
      const data = await res.json();
      if (res.status === 202 && data.jobId) {
        activeDatasets = await pollJob(data.jobId);
        console.log(`Loaded datasets: ${activeDatasets.join(", ")}`);
      } else {
        console.error("Failed to start ingestion:", data.error || data.message);
      }
    } catch (e) {
      console.error("Could not reach the local Next.js API. Is it running?", e);
    }
  }

  console.log("\nAsk a question about the codebase's bug history. Type 'exit' to quit.\n");

  while (true) {
    const question = await ask("\n> ");

    if (question.trim().toLowerCase() === "exit") {
      break;
    }

    if (!question.trim()) {
      continue;
    }

    try {
      console.log("\nSearching memory...\n");
      const { askRootCause } = await import('./queryBuilder');
      const result = await askRootCause(question, {
        datasetNames: activeDatasets.length > 0 ? activeDatasets : undefined,
      });
      
      // Print the main answer
      if (result?.result?.kind === "Text") {
        console.log("Answer:");
        console.log(result.result.data);
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }

  rl.close();
  process.exit(0);
}

main();