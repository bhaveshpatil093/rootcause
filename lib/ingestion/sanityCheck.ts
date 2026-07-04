import { cognee } from './cogneeClient';

async function main() {
  console.log("--- Cognee SDK Sanity Check ---");

  try {
    // NOTE: An LLM_API_KEY or OPENAI_API_KEY is required in your environment variables for this to succeed.
    console.log("Remembering: { type: 'text', text: 'test string' } into dataset 'test-dataset'");
    await cognee.remember({ type: "text", text: "test string" }, "test-dataset");
    
    console.log("Recalling: 'test'");
    const results = await cognee.recall("test");
    
    console.log("Recall Results:");
    console.log(JSON.stringify(results, null, 2));
    
    console.log("Sanity check completed successfully.");
  } catch (error) {
    console.error("Sanity check failed:", error);
    process.exit(1);
  }
}

main();
