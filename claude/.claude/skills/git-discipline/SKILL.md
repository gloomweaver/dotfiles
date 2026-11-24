---
name: git-discipline
description: Enforces clean git staging, forbids catch-all git commands, and ensures atomic commit messages.
---

# Git Discipline Protocol

When handling version control operations:

1. **Explicit Staging Only:**
   - NEVER run `git add .` or `git add -A`. Stage only the exact files modified for the task (`git add <file1> <file2>`).
2. **Pre-Stage Status Check:**
   - Always run `git status --short` before staging to verify no generated artifacts, credentials (`.env*`), or temporary files are present.
3. **Commit Messages:**
   - Use Conventional Commits format: `<type>(<scope>): <imperative summary>`.
   - Keep the summary under 72 characters.
   - Never write vague messages like `fix: address comments` or `wip`. Specify the mechanical change.
4. **Safety Invariants:**
   - Never run `git reset --hard`, `git clean -f`, or `git checkout .` without explicit user instruction.
   - Never force-push (`--force` or `-f`).
