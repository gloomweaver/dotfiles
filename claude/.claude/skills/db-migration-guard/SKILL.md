---
name: db-migration-guard
description: Enforces zero-downtime database migrations, safe index creation, and reversible schema changes.
---

# Database Migration Protocol

When creating or modifying SQL migrations, ORM schemas (Prisma, TypeORM, Drizzle), or Liquibase/Flyway scripts:

1. **Non-Blocking Indexes:**
   - In PostgreSQL, always use `CREATE INDEX CONCURRENTLY` or `DROP INDEX CONCURRENTLY`. Never run bare `CREATE INDEX` on existing tables.
2. **Zero-Lock Column Additions:**
   - Avoid `NOT NULL` columns without default values on non-empty tables.
   - For heavy defaults, verify the database engine version supports metadata-only defaults rather than full-table rewrites.
3. **Expand and Contract (Two-Phase):**
   - Never rename or drop active columns in a single migration.
   - Follow the expand/contract pattern: add new column -> dual-write/backfill -> switch reads -> deprecate/drop old column in a later release.
4. **Reversibility:**
   - Every migration must have an explicit, tested rollback/down migration.
   - No destructive `DROP TABLE` or `TRUNCATE` operations without explicit confirmation.
