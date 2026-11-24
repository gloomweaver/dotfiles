---
name: adversarial-review
description: Performs an adversarial, hostile audit on git diffs looking for correctness and edge-case failures.
---

# Adversarial Review Protocol

Analyze the diff between the current branch and `main` (or specified target). Challenge every assumption:

1. **Correctness & Edge Cases:**
   - Look for off-by-one errors, division by zero, float precision loss, and boundary conditions.
   - Check async code for unhandled rejections, race conditions, and missing idempotency keys.
2. **Data & Concurrency:**
   - Identify N+1 query patterns, lack of indexing on filtered columns, and transaction leaks.
3. **Defensive Ingestion:**
   - Are external inputs strictly validated at the boundary, or are unchecked primitives passed into domain logic?
4. **Output Format:**
   - **Critical Bugs:** Blocker defects that will break production.
   - **Regressions / Performance:** Latency, CPU/memory bloat, unindexed lookups.
   - **Verdict:** Strict `REJECT` or `PASS`. Ignore formatting or stylistic opinions.
