---
name: municipality-ui-admin
description: Refine Pinamungajan public/admin layouts, department cards/pages, navigation presentation, legislative tables, accessibility and responsive styling. Pair with departments-rbac only when visibility or access rules change.
---
# Municipal UI

Preserve the established restrained government design: readable typography, clear hierarchy, spacing, contrast, keyboard access and responsive layouts. Reuse current components/styles before creating variants.

- Keep public Header/Footer within `app/(public)`. Login and Admin/Superadmin use their own layouts. No public login button or hyperlink; login is reached by URL.
- Directory: reuse DepartmentGrid and DepartmentImage for database name/acronym, image, description and `/departments/[slug]` links; keep the shared missing/broken-image placeholder. Include head details only when the requested design needs them.
- Detail: preserve the current shared layout: identity hero; head photo left and title/name/description right (stack on mobile); body; NewsGrid; ProgramGrid; DepartmentContacts. Use current-record values, hide empty contact groups and use existing empty states. Do not replace this with an older generic section order.
- Leadership: reuse LeadershipSection/OfficialGrid for current officials; use database department/head records when adding department leadership cards. Do not invent people or silently replace the existing official-based section. Directory View All links go to `/departments`.
- `Your offices` uses assigned database short names/names without redundant branch prefixes. Legislative Access is one office link; modules belong inside its dashboard, not separate offices. Reuse AdminShell/SidebarNav and breadcrumbs. Use [departments-rbac](../departments-rbac/SKILL.md) for visibility decisions.
- Ordinance/resolution tables prioritize wrapping long titles with compact metadata columns. Check mobile overflow, focus behavior and desktop readability.

Inspect `app/globals.css`, `app/staff.css` and affected components. Validate relevant public/admin browser scenarios; review desktop/mobile screenshots when layout changes. Pure styling does not require loading database references.
