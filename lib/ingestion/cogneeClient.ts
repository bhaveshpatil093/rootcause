import { Cognee } from '@cognee/cognee-ts';
import { logger } from './logger';

export const cognee = new Cognee({
  llmProvider: process.env.COGNEE_LLM_PROVIDER || "openai",
  llmModel: process.env.COGNEE_LLM_MODEL || "meta/llama-3.1-8b-instruct",
  llmApiKey: process.env.NVIDIA_API_KEY || "", // Must be provided in .env.local
  llmEndpoint: process.env.COGNEE_LLM_ENDPOINT || "https://integrate.api.nvidia.com/v1",
  embeddingProvider: process.env.COGNEE_EMBEDDING_PROVIDER || "onnx",
  embeddingModel: process.env.COGNEE_EMBEDDING_MODEL || "bge-small-en-v1.5",
});

/**
 * Utility function to wrap Cognee SDK calls with simple exponential backoff retry logic.
 */
export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      if (attempt >= maxRetries) {
        throw error;
      }
      const backoffMs = Math.pow(2, attempt) * 1000;
      logger.warn(`[Cognee Retry] Attempt ${attempt} failed (${error.message}). Retrying in ${backoffMs}ms...`);
      await new Promise((res) => setTimeout(res, backoffMs));
    }
  }
  throw new Error("Unreachable");
}