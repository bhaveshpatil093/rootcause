import { cognee } from '../ingestion/cogneeClient';

async function seedCorrection() {
  const correction = "CORRECTION to commit a1b2c3d (June 10 auth token fix): This fix did NOT hold. The same root cause — race condition between session initialization and token refresh — resurfaced on June 28 in commit q3r4s5t under a different symptom (session lost after refresh). The June 10 fix should be considered unresolved/superseded.";

  console.log("Pushing correction into Cognee...");
  await cognee.remember({ type: "text", text: correction }, "commits-corrections");
  console.log("Done.");
}

seedCorrection();