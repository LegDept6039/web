---
name: dynamic-content-database
description: Modify Pinamungajan Supabase schema, migrations, content adapters, department-owned news/programs/contacts, or media storage. Use for data behavior, not presentation-only changes.
---
# Dynamic content and database

Read [database-model.md](references/database-model.md) for schema, adapters or media work; read [migrations.md](references/migrations.md) before schema changes.

- Extend canonical `departments`; preserve stable UUIDs and existing FKs. Do not recreate parallel office/profile systems, per-department tables or source registries.
- Store editable municipal content in related database records. Keep slugs unique and preserve aliases. New active/published Executive departments must work in the directory and shared route without source changes.
- Match ownership/publication filters in queries and access policies. Use [departments-rbac](../departments-rbac/SKILL.md) for authorization rules rather than duplicating them here.
- Use incremental migrations, appropriate constraints/indexes/timestamps, and existing archival/deactivation behavior. Preserve content, authorship and referenced uploads; do not generalize destructive deletion to important records.
- Keep credentials server-only. Store media URLs/paths, not image binaries in text fields; reuse validated uploads and shared placeholders.
- Validate adapter/schema changes with data tests and real local SQL policy tests. Separate those results from hosted verification.

Report each new migration's order, effects, preservation limits and whether it was actually applied. Do not apply production migrations automatically.
