import { cognee } from '../ingestion/cogneeClient';

const demoTexts = [
  "Commit a1b2c3d by shreya on 2026-06-10: 'fix: resolve null pointer in auth token refresh' — touched files: auth.ts, tokenManager.ts. Root cause: token refresh was called before the session object was initialized, causing a race condition on cold start.",
  "Commit e4f5g6h by shreya on 2026-06-15: 'fix: JWT expiry check throwing on undefined token' — touched files: auth.ts, middleware.ts. Root cause: same underlying race condition as the earlier auth token bug — session initialization order was still not guaranteed under high concurrency.",
  "Commit i7j8k9l by bhavesh on 2026-06-18: 'fix: CORS preflight failing on POST requests' — touched files: server.ts, corsConfig.ts. Root cause: duplicate CORS middleware registered in both the global app config and a route-level override, causing conflicting headers.",
  "Commit m0n1o2p by bhavesh on 2026-06-22: 'fix: WebSocket connection silently dropping after 30s' — touched files: websocket.ts. Root cause: heartbeat interval was written using JS template literal syntax inside a Python-adjacent config string, so it evaluated to NaN and disabled the keep-alive ping.",
  "Commit q3r4s5t by shreya on 2026-06-28: 'fix: auth session lost after token refresh (regression)' — touched files: auth.ts, tokenManager.ts. Root cause: the June 10 fix was reverted by an unrelated merge, reintroducing the original race condition — same root cause resurfacing under a new symptom description.",
  "CORRECTION to commit a1b2c3d (June 10 auth token fix): This fix did NOT hold. The same root cause — race condition between session initialization and token refresh — resurfaced on June 28 in commit q3r4s5t under a different symptom (session lost after refresh). The June 10 fix should be considered unresolved/superseded.",
];

async function seedDemo() {
  const entries = demoTexts.map((text) => ({ type: "text" as const, text }));

  console.log(`Seeding ${entries.length} entries into "demo-auth-bug" in one batch...`);
  await cognee.remember(entries, "demo-auth-bug");
  console.log("Done.");
}

seedDemo();