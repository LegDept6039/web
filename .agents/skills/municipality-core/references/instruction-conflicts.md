# Historical guidance audit (2026-10-06)

Use current implementation and `docs/DYNAMIC-DEPARTMENTS.md` for the migration-010 baseline. These conflicts were identified while authoring skills; the source files listed here were not rewritten as part of that task.

| Existing source | Stale or conflicting instruction | Current interpretation |
| --- | --- | --- |
| `.env.example`; README Content/Deployment sections | Mock mode is the default; template sets `CONTENT_SOURCE=mock` | `lib/content/config.ts` defaults to Supabase. Copying the template explicitly enables mock mode: do not use that setting for normal development/production unless requested. |
| README setup/deployment and older setup lists in `docs/SUPABASE.md` | Only early migrations listed; generic seed-rerun advice | Current schema needs migrations through 010. Historical optional seed belongs before 008; never replay it blindly against consolidated departments. |
| `docs/ADMIN-IMPLEMENTATION.md` | Separate authorization offices and department profiles; office deletion by FK restrictions | 009 unifies identities in `departments`; `offices` is a compatibility view. All permanent department deletion is blocked. |
| `docs/DEPARTMENT-IMPLEMENTATION.md` | New offices get unpublished profiles; editors change slug/publication; editors cannot delete records | Historical 008 behavior. 010 reserves identity/publication to Superadmin; Executive editors can delete owned news/programs/contacts with write access. |
| `docs/AUTH.md` Office management/Storage sections | `/superadmin/offices`, conditional deletion, dashboard-only media uploads | Canonical management is `/superadmin/departments`; deactivation preserves records. Department/head/official photos upload through website forms. |
| Older implementation notes and migrations 005-006 | Per-module Legislative permissions or separate Legislative offices | Historical upgrade stages only. 007+ uses one Legislative Access scope, no module checklist. |

The generated Next.js block in root `AGENTS.md` is compatible and must remain. Historical SQL/tests are migration evidence, not current runtime registries; do not delete them to hide obsolete names.

The skill request's generic schema/layout examples are not instructions to recreate tables or reorder working UI: current fields are `staff_accounts`, `user_office_access.office_id`, inline department heads and four contact types. Current detail layout is head overview -> body -> news -> programs -> contacts. Home leadership uses `officials`; do not silently replace it with department records.
