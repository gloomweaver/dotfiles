---
name: task-planner
description: Enforces an explicit on-disk task checklist for multi-step implementations to prevent context drift.
---

# Task Planner Protocol

For any task touching more than 2 files or requiring multiple sequential steps:

1. **Plan First:**
   - Before executing code edits, generate a short, numbered operational plan with checkboxes (`- [ ]`).
   - Break work into atomic phases: Discovery -> Implementation -> Test Reproduction -> Verification.
2. **Live State Tracking:**
   - Mark items complete (`- [x]`) as each phase is finished and verified.
   - If an unexpected error or edge case occurs, update the plan explicitly before improvising changes.
3. **No Goal Drift:**
   - Do not pick up tangential refactors discovered mid-plan. Log them under an `Out of Scope / Follow-up` section and stay focused on the primary objective.
