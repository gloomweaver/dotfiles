---
name: scope-guard
description: Enforces strict surgical diffs and prevents scope creep or cosmetic refactoring.
---

# Scope Guard Protocol

When implementing any change:
1. **Surgical Diffs Only:** Modify only the exact lines and files necessary to fulfill the prompt. Do not touch adjacent functions, import formatting, or unrelated files.
2. **Zero Unsolicited Refactoring:** Never rename variables, extract helper methods, or "clean up" surrounding code unless explicitly asked.
3. **No Boilerplate Inflation:** Do not write hand-rolled primitive validators, custom wrapper classes, or speculative future-proof abstractions. Use existing project utilities and stdlib primitives.
4. **No Fluff Comments:** Never add self-evident comments (e.g. `// calculate total`), JSDoc/docstrings on internal code, or explanatory commentary inside the diff.
5. **Pre-Commit Diff Check:** Before declaring work done, run `git diff --stat` and ensure zero unintended files or formatting noise are present.
