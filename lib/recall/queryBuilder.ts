import { cognee } from '../ingestion/cogneeClient';

export async function askRootCause(
  question: string,
  options?: { datasetNames?: string[] }
) {
  if (!options?.datasetNames || options.datasetNames.length === 0) {
    const recallResult = await cognee.recall(question, { topK: 10 });
    return recallResult.searchResponse;
  }

  const datasets = await cognee.datasets.list();
  const datasetIds = datasets
    .filter((d: any) => options.datasetNames!.includes(d.name))
    .map((d: any) => d.id);
    console.log("Resolved datasetIds:", datasetIds);

  const searchResponse = await cognee.search(question, {
    topK: 10,
    datasetIds: datasetIds.length > 0 ? datasetIds : undefined,
  });

  return searchResponse;
}