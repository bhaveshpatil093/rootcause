import { Cognee } from '@cognee/cognee-ts';

export const cognee = new Cognee({
  llmModel: "gpt-4o-mini",
  llmApiKey: process.env.OPENAI_API_KEY,
  llmEndpoint: "https://models.inference.ai.azure.com",
  embeddingProvider: "onnx",
  embeddingModel: "bge-small-en-v1.5",
});