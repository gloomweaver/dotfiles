---
name: dependency-guard
description: Blocks unnecessary third-party package additions and ensures lockfile consistency.
---

# Dependency Guard Protocol

1. **Stdlib First:**
   - Never install a third-party dependency for operations achievable with language primitives or standard library APIs (e.g. `lodash`, `left-pad`, `is-odd`, `uuid` if Web Crypto exists).
2. **Pre-Install Approval:**
   - Do not run `npm install <pkg>`, `pnpm add <pkg>`, or `cargo add <pkg>` without explicitly justifying why an existing utility or standard API cannot solve the problem.
3. **Lockfile Invariants:**
   - Never delete or hand-edit `package-lock.json`, `pnpm-lock.yaml`, or `Cargo.lock`.
   - Never use `--legacy-peer-deps` or `--force` as workarounds for dependency graph resolution conflicts.
