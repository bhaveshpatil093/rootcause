import 'dotenv/config';
import { cognee } from '../lib/ingestion/cogneeClient';

async function listDatasets() {
  console.log("Fetching datasets from Cognee...");
  const datasets = await cognee.datasets.list();
  
  console.log("\n--- Available Datasets ---");
  for (const ds of datasets) {
    console.log(`- ${ds.name} (ID: ${ds.id})`);
  }
}

listDatasets().catch(console.error);
