---
name: verification-gate
description: Enforces test-first reproduction and deterministic verification before marking tasks complete.
---

# Verification Gate Protocol

Never consider a task complete without verifiable evidence:

1. **Bug Fixes (Red-to-Green):**
   - Write or identify a test that reproduces the bug and demonstrates failure.
   - Apply the fix.
   - Run the test suite and confirm it passes.
2. **Deterministic Checks:**
   - Always run the relevant linter (`eslint`, `biome`, `cargo clippy`, etc.) and type checker (`tsc --noEmit`, etc.) on modified files.
   - If tests cannot be run (e.g., missing dependencies/environment), explicitly declare that the fix is unverified and explain why.
3. **No Assumption of Success:**
   - Never say "This should now work." Verify it with a shell command or state: `Unverified: requires manual check because <reason>`.
