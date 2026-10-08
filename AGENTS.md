<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project skills

Use the relevant repository skills in `.agents/skills` for this project. Load only matching skills and task-relevant references; do not load all four by default.

- [municipality-core](.agents/skills/municipality-core/SKILL.md): architecture, routing, cross-feature work and deployment diagnosis.
- [departments-rbac](.agents/skills/departments-rbac/SKILL.md): staff authentication, assignments, permissions and access visibility.
- [dynamic-content-database](.agents/skills/dynamic-content-database/SKILL.md): Supabase schema, migrations, content adapters and media.
- [municipality-ui-admin](.agents/skills/municipality-ui-admin/SKILL.md): public/admin presentation, responsive layouts and tables.

These skills document the current migration-010 architecture. For conflicts with historical setup notes, consult the core skill's instruction-conflicts reference; do not restore obsolete architecture from older documentation.
