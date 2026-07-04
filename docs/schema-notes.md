# Schema & Ingestion Notes

This document outlines the architectural decisions and heuristics used in the RootCause ingestion pipeline, specifically regarding how we detect bug fixes and link them to our knowledge graph.

## Fix-Detection & Bug-Linking Logic

Our system maps the unstructured reality of a Git repository into a strict schema of `Commits`, `Files`, `Functions`, `Bugs`, and `Fixes`. A critical part of this process is determining when a commit represents a bug fix.

### The Heuristic Approach

Instead of using a complex ML classification model or an LLM to analyze every single commit message, we rely on a fast, regex-based heuristic.

The logic (found in `lib/ingestion/detectFixes.ts`) is straightforward:
1. **Keyword Matching**: We convert the commit message to lowercase and look for explicit keywords: `fix`, `bug`, `resolve`, `patch`, `hotfix`.
2. **Exclusion Rules**: We ensure that these keywords aren't accidentally matched inside compound words (e.g., `prefix`, `postfix`, `fixture`, `affix`).
3. **Extraction**: If a commit is flagged as a fix, we clean up the message by stripping standard Git prefixes (like `fix:`, `hotfix:`) and capitalizing it. This cleaned string becomes the `Bug`'s human-readable description.

Once a commit is identified as a fix, `extractEntities.ts` automatically creates a `Bug` entity and a corresponding `Fix` entity. The `Fix` is linked directly to the `Commit`, which is inherently linked to the specific `Files` and `Functions` it touched via AST mapping.

### Why Simplicity over ML Classification?

Given the time constraints of building the MVP and the aggressive rate limits of free-tier LLM providers (like NVIDIA Nim), we opted for simplicity. 

Using an LLM to classify and summarize every single commit message across a repository's history would:
- Severely throttle ingestion times due to API rate limits (e.g., HTTP 429s).
- Introduce non-deterministic results into the foundational schema.
- Dramatically increase API costs for large repositories.

The regex heuristic is $O(1)$ and executes locally in microseconds, ensuring that the pipeline remains resilient and highly scalable for the MVP phase.

### Known Limitations

This simplistic approach has several trade-offs:
1. **Silent Fixes**: If a developer writes a commit message like *"Corrected the edge case in calculator module"* without using the word "fix" or "bug", the system will completely miss it.
2. **False Positives**: A commit message like *"Add temporary fix for CI pipeline"* might be flagged as a bug fix in the production code, even though it only affects tooling.
3. **Missing Context**: The heuristic relies entirely on the commit message. If the message says *"fix typo"*, the system registers a bug described as "Typo", without understanding the severity or context.

Future iterations of RootCause may offload this to a lightweight, fine-tuned local classification model to improve accuracy without sacrificing speed.
