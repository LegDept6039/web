---
name: municipality-core
description: Guide Pinamungajan portal architecture, shared routing, Executive/Legislative structure, cross-feature changes, and deployment diagnosis. For isolated permission, database, or visual edits, use the focused project skill instead.
---
# Municipality core

Work on the Municipality of Pinamungajan, Cebu portal: Next.js App Router, TypeScript, Supabase, GitHub and Vercel. Read related implementation, current migrations, authorization helpers and reusable components before making the smallest safe change. Preserve unrelated working behavior.

- Supabase is the default content and authentication source. Use mock content only when explicitly requested for isolated tests/previews; never fall back to it on database failure.
- Executive departments are database records, not a source registry. Reuse `/departments` and `/departments/[slug]`; adding an office must not require a new page, component branch or role.
- Legislative has one administrative scope, `Legislative Access`. Public official distinctions are content, not account roles.
- Follow root `AGENTS.md`, including the installed Next.js documentation requirement. Do not apply remembered conventions over the installed version.
- For permission changes use [departments-rbac](../departments-rbac/SKILL.md); for schema/content/storage use [dynamic-content-database](../dynamic-content-database/SKILL.md); for presentation use [municipality-ui-admin](../municipality-ui-admin/SKILL.md). Load only applicable skills.

Read [architecture.md](references/architecture.md) when tracing data/routes or choosing checks. Read [deployment.md](references/deployment.md) only for environment, hosting or production troubleshooting. Read [instruction-conflicts.md](references/instruction-conflicts.md) when older setup guidance disagrees with current code.
