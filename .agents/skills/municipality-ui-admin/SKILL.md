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
- `Your offices` uses assigned database short names/names without redundant branch prefixes. Admin and Superadmin share `OfficesNav` expandable office menus; Legislative Access remains one office with its permitted modules nested beneath it. Reuse AdminShell/SidebarNav and breadcrumbs. Use [departments-rbac](../departments-rbac/SKILL.md) for visibility decisions.
- Ordinance/resolution tables prioritize wrapping long titles with compact metadata columns. Check mobile overflow, focus behavior and desktop readability.

Inspect `app/globals.css`, `app/staff.css` and affected components. Validate relevant public/admin browser scenarios; review desktop/mobile screenshots when layout changes. Pure styling does not require loading database references.

## Admin loading feedback

- Keep skeleton loading feedback for `/admin` initial loads and nested page transitions. Reuse `AdminSkeleton`, `AdminTableSkeleton`, and `AdminFormSkeleton` from `components/shared/PageSkeleton.tsx`; choose dashboard, list/table, or form shapes to match the destination.
- Put `loading.tsx` at the relevant route segment, including content collections and create/edit pages. A root admin loading boundary alone may remain shared across sibling navigation. Keep navigation interactive while page content loads. Do not add artificial production delays just to display a skeleton; cached pages can open immediately.
- Preserve the protected layout Suspense fallback and StaffSessionBoundary session-check skeleton. Loading feedback must not bypass authorization or obscure authentication errors.
- Skeletons use a single accessible loading status, decorative shapes hidden from assistive technology, responsive geometry, and the shared reduced-motion-aware animation in `app/globals.css`.
- Verify slow transitions with the opt-in Supabase transport fixture latency in `playwright.loading.config.ts`, including skeleton-to-content replacement, desktop/mobile overflow, and reduced motion. No live database latency should be introduced.
