---
name: find-skills
description: Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities.
---

# Find Skills

This skill helps you discover and install skills from the open agent skills ecosystem.

## When to Use This Skill

Use this skill when the user:

- Asks "how do I do X" where X might be a common task with an existing skill
- Says "find a skill for X" or "is there a skill for X"
- Asks "can you do X" where X is a specialized capability
- Wants to search for tools, templates, or workflows

## What is the Skills CLI?

The Skills CLI (`npx skills`) is the package manager for the open agent skills ecosystem.

**Key commands:**

- `npx skills find [query]` - Search for skills
- `npx skills add <package>` - Install a skill
- `npx skills check` - Check for updates
- `npx skills update` - Update all installed skills

**Browse skills at:** https://skills.sh/

## How to Help Users Find Skills

### Step 1: Understand What They Need

Identify the domain and specific task.

### Step 2: Search for Skills

```bash
npx skills find [query]
```

### Step 3: Present Options

Show the skill name, install command, and link.

### Step 4: Offer to Install

```bash
npx skills add <owner/repo@skill> -g -y
```

## Common Skill Categories

| Category | Example Queries |
|---|---|
| Web Development | react, nextjs, typescript, css, tailwind |
| Testing | testing, jest, playwright, e2e |
| DevOps | deploy, docker, kubernetes, ci-cd |
| Documentation | docs, readme, changelog, api-docs |
| Code Quality | review, lint, refactor, best-practices |
| Design | ui, ux, design-system, accessibility |
| Productivity | workflow, automation, git |
