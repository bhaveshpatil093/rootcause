async function runFinalDemoIngestion() {
  const repoUrl = 'https://github.com/axios/axios.git';
  console.log(`Starting final ingestion for LIVE DEMO on repo: ${repoUrl}`);

  const ingestRes = await fetch('http://localhost:3000/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      githubUrl: repoUrl,
      maxCommits: 30, // Safe number for live demo time limits and NVIDIA Nim rate limits
      dryRun: false
    })
  });
  
  const ingestData = await ingestRes.json();
  const jobId = ingestData.jobId;
  console.log("Job ID:", jobId);

  let datasetNames: string[] = [];
  
  while (true) {
    const statusRes = await fetch(`http://localhost:3000/api/ingest/status/${jobId}`);
    const statusData = await statusRes.json();
    console.log(`Status: ${statusData.status} - ${statusData.message}`);
    
    if (statusData.status === 'completed') {
      datasetNames = statusData.datasetNames || [];
      console.log("Ingestion Stats:", statusData.stats);
      break;
    } else if (statusData.status === 'failed') {
      console.error("Ingestion failed:", statusData.error);
      return;
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log("Ingestion completed! Ready for the live demo!");
  console.log("Dataset mapped:", datasetNames);
}

runFinalDemoIngestion().catch(console.error);
