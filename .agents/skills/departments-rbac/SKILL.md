---
name: departments-rbac
description: Change Pinamungajan staff authentication, users, Superadmin workflows, department assignments, authorization, permission-aware navigation, or access RLS. Not needed for purely visual department edits.
---
# Departments and access

Read [authorization-model.md](references/authorization-model.md) when changing guards, roles, ownership or policies; inspect the named helpers and current SQL before editing.

- Keep roles `superadmin`, `admin`, `editor`, `viewer`. Departments are memberships, never role-enum values. Preserve multiple explicit assignments.
- Only active Superadmins create departments and manage identity/access, through `/superadmin/departments`; user management stays in `/superadmin/users`. Routine administration must work through the website.
- `/admin` edits authorized content, not department identities. Preserve deactivation and the ban on permanent department deletion.
- Derive identity, role and membership from verified Supabase authentication and live staff/database records. Check existing record ownership before update/delete and validate target ownership on create. A submitted role or office ID grants nothing.
- Enforce permissions in actions/routes and PostgreSQL RLS, not just navigation. Reuse existing guards and Server Actions; do not add a parallel REST or permission system.
- Keep one Legislative Access office with role/level limits and no module checkbox permissions. Executive-only users cannot enter Legislative modules; explicit additional Legislative membership is evaluated normally.

Test own-office success, cross-office/branch denial, forged creation/identity writes, viewer limits, Superadmin operations and revocation. Keep UI naming/layout decisions in [municipality-ui-admin](../municipality-ui-admin/SKILL.md).
