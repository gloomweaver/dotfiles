---
name: blast-radius
description: Audits all call sites and downstream consumers before modifying shared types, schemas, or function signatures.
---

# Blast Radius Protocol

Before modifying any exported function, type/interface, database column, or shared contract:

1. **Find All Consumers:**
   - Use `ripgrep` or LSP symbol references to locate every import and invocation of the target symbol across the entire repository.
   - Do not assume consumers are only in the same package or directory.
2. **Contract Compatibility:**
   - If changing an argument or return type, determine whether it is a breaking change.
   - If breaking, update all consumer call sites in the same commit, or propose an explicit deprecation path.
3. **Report Downstream Impact:**
   - List the modified consumer files and confirm that the project-wide type check (`tsc`, `cargo check`, etc.) passes cleanly across all of them.
