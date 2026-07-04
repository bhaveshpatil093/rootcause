import crypto from 'crypto';
import { cognee } from '../ingestion/cogneeClient';
import { askRootCause } from './queryBuilder';

async function main() {
  const githubUrl = "https://github.com/ShreyaShelar08/log-analyzer";
  const repoHash = crypto.createHash('md5').update(githubUrl).digest('hex');
  const datasetName = `commits-${repoHash}`;

  console.log("Listing all datasets...");
  const datasets = await cognee.datasets.list();
  console.log(JSON.stringify(datasets, null, 2));

  const match = datasets.find((d: any) => d.name === datasetName);
  if (!match) {
    console.log(`\nNo dataset found matching name: ${datasetName}`);
    return;
  }

  const datasetId = (match as any).id;
  console.log(`\nFound dataset ID: ${datasetId}`);

   const question = "what does this codebase do?";
  console.log(`\nAsking: "${question}"`);

  const searchResponse = await cognee.search(question, {
    topK: 10,
    datasetIds: [datasetId],
  });

  const answer = searchResponse.result?.kind === "Text"
    ? searchResponse.result.data
    : JSON.stringify(searchResponse);

  console.log("\nAnswer:", answer);
}

main();