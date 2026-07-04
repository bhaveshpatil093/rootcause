# RootCause Live Demo Script

## Goal
Demonstrate how RootCause can analyze a messy, real-world repository (Axios) to build a corporate memory graph, and then answer complex, historical debugging questions with 100% accuracy using semantic search + deterministic graph traversal.

## Preparation (Before taking the stage)
1. Ensure your local Next.js dev server is running (`npm run dev`).
2. Make sure you have your `.env.local` configured with the NVIDIA Nim API keys.
3. Open a browser to `http://localhost:3000`.
4. Open a terminal tab ready to show logs.
5. (Optional) Keep the `docs/demo-fallback.md` guide open just in case conference Wi-Fi drops.

---

## Step 1: The Setup (0:00 - 1:00)

**Speaker Track:** 
> "Every developer knows the pain of fixing a bug, only to find out six months later that someone else reintroduced it because they didn't know *why* you wrote the code that way. Documentation rots, but git history is forever. RootCause acts as a corporate memory for your codebase by parsing your git history, understanding your bug fixes, and mapping them to a queryable knowledge graph."

**Action:** 
1. Open the RootCause Web UI (`http://localhost:3000`).
2. Point out the clean UI.

## Step 2: Ingestion (1:00 - 3:00)

**Speaker Track:**
> "Let's run this against a real, very active repository: Axios. We are going to point RootCause at the Axios GitHub URL. It will shallow clone the repo, parse the AST to map the functions, use an LLM to read the commit diffs to understand what bugs were fixed, and then push those semantic relationships into our local LanceDB graph."

**Action:**
1. In the "OPEN CASE FILE" input box, paste: `https://github.com/axios/axios`
2. Click **Analyze Repository**.
3. *Switch to the terminal running the dev server to show the beautiful colored logs (`ℹ️ [RootCause] Extracting AST...`).*
4. Explain that we are extracting Entities (Bugs, Commits, Functions) and mapping the relationships (`FIXED_BY`, `TOUCHES`).

## Step 3: Investigation (3:00 - 4:30)

**Speaker Track:**
> "Now that our codebase's history is in the graph, we can debug with context. Let's imagine we ran into a bug with abort controllers or network timeouts—classic Axios issues. Let's ask RootCause if this has happened before."

**Action:**
1. Wait for the ingestion progress bar in the UI to reach 100% and show "Case opened!".
2. In the Investigation search box, type a query relevant to Axios, such as: 
   *`"Why did the abort controller timeout bug happen, and has it resurfaced before?"`*
3. Click **Investigate**.
4. RootCause will query the vector database to understand "abort controller timeout", find the `Bug` node, traverse the graph to the fix `Commit`, see if any newer commits `REVERTED_BY` it, and generate an answer.

## Step 4: The Reveal (4:30 - 5:00)

**Action:**
1. The UI will render the answer in the Analysis box.
2. Point out the **Investigation Verdict** badge on the right side. It will clearly label if the bug is **RESOLVED**, **RESURFACED**, or has **NO PRIOR RECORD**.
3. Point out the **Related Commits** list, proving that the AI is citing exact Git SHAs from the graph traversal rather than hallucinating.

**Speaker Track:**
> "As you can see, RootCause didn't just guess—it cited the exact commit hashes where this logic was introduced and modified. Debugging is no longer déjà vu. Thank you."
