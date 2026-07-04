async function runTest() {
  console.log("Starting ingestion...");
  const ingestRes = await fetch('http://localhost:3000/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      githubUrl: 'https://github.com/bhaveshpatil093/rootcause',
      maxCommits: 5,
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
      break;
    } else if (statusData.status === 'failed') {
      console.error("Ingestion failed:", statusData.error);
      return;
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log("Ingestion completed! Datasets:", datasetNames);
  console.log("Querying recall...");

  const recallRes = await fetch('http://localhost:3000/api/recall', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: "What files did we modify to add the background job architecture?",
      datasetNames
    })
  });

  const recallData = await recallRes.json();
  console.log("Recall Answer:", recallData.answer);
}

runTest().catch(console.error);
