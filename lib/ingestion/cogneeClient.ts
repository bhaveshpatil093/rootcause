import { Cognee } from '@cognee/cognee-ts';

export const cognee = new Cognee({
  llmProvider: "openai",
  llmModel: "meta/llama-3.1-8b-instruct",
  llmApiKey: process.env.NVIDIA_API_KEY || "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",
  llmEndpoint: "https://integrate.api.nvidia.com/v1",
  embeddingProvider: "onnx",
  embeddingModel: "bge-small-en-v1.5",
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
      console.warn(`[Cognee Retry] Attempt ${attempt} failed (${error.message}). Retrying in ${backoffMs}ms...`);
      await new Promise((res) => setTimeout(res, backoffMs));
    }
  }
  throw new Error("Unreachable");
}