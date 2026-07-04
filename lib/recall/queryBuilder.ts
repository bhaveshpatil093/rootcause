import { cognee, withRetry } from '../ingestion/cogneeClient';

export async function askRootCause(
  question: string,
  options?: { datasetNames?: string[] }
) {
  if (!options?.datasetNames || options.datasetNames.length === 0) {
    const recallResult = await withRetry(() => cognee.recall(question, { topK: 10 }));
    return recallResult.searchResponse;
  }

  const datasets = await withRetry(() => cognee.datasets.list());
  const datasetIds = datasets
    .filter((d: any) => options.datasetNames!.includes(d.name))
    .map((d: any) => d.id);
    console.log("Resolved datasetIds:", datasetIds);

  if (datasetIds.length === 0) {
    throw new Error("No matching dataset found for this repo — try re-ingesting");
  }

  const searchResponse = await withRetry(() => cognee.search(question, {
    topK: 10,
    datasetIds,
  }));

  return searchResponse;
}