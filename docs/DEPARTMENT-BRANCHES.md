# Department branches (migration 034)

Apply the **contents** of `supabase/migrations/202611240034_department_branches.sql` in Supabase SQL Editor after migration 033, then deploy the matching application. This migration has been tested locally; it has not been applied to the hosted database by the implementation.

## Managing a branch

Open **Superadmin → Branches** to manage branch offices, separately from the main **Departments** list. Choose **Add Branch**, enter its name and details, and select the required **Parent department**. Existing branches use the same image, head, body, news, program, service and contact editing workflows. Superadmin can reparent an existing branch or clear its parent to make it a top-level department; the save returns to the matching list.

Top-level departments are managed at `/superadmin/departments`; branches use `/superadmin/branches`, `/superadmin/branches/new` and `/superadmin/branches/[id]`. Old department edit addresses for branch records redirect to the canonical branch editor. Each list applies its parent filter before pagination. Staff assignments and permissions remain separate from this navigation organization.

The parent must be a nonarchived, ordinary top-level Executive department. Legislative Access and Barangay Affairs cannot be parents or branches. A branch cannot have its own branches, reference itself, or form a cycle. A parent with existing branches cannot become a branch. Parent relationships are identity settings: only Superadmin may change them. Generic department editors cannot forge a parent change through a direct SQL/API update.

Branches have their own UUID and explicit Office Access assignments. Parent staff receive no automatic access to branches, and branch staff receive no automatic access to the parent or siblings. Assign each required office through **Users & access control**. Existing role, permission-level, revocation and password/session checks continue to apply.

## Public pages

The main `/departments` directory lists top-level departments and has a separate **Branches** section with picture cards. Parent pages list their public branches in text-only directory cards. Each branch uses the existing `/departments/[slug]` route with its own image and content. A branch page is public only while both the branch and its parent are active, published and nonarchived. The same rule covers public aliases and branch contacts.

Deactivating, unpublishing or archiving a parent hides its public branches without deleting or changing the branch records. Staff with an explicit active branch assignment can still edit that branch. An unchanged parent relationship remains valid for content edits after the parent is archived; selecting an archived parent for a new or changed relationship is rejected.

General published news and programs keep their existing publication behavior. Their public source link is omitted while its department page is hidden. Unrelated top-level contact visibility keeps its previous policy behavior.

## Seed and preservation

The migration creates these missing profiles with blank acronyms, descriptions and body, no uploaded image, and published status:

| Parent | Branch | New-profile slug |
| --- | --- | --- |
| Municipal Treasurer's Office | Market Affairs | `market-affairs` |
| Municipal Treasurer's Office | Slaughter House | `slaughter-house` |
| Municipal Engineering Office | Waterworks | `waterworks` |

The existing shared image placeholder appears until an image is uploaded. Newly seeded published records are appended after the existing Executive display positions. Parents are resolved from their existing canonical identity, acronym and slug aliases; no hosted UUID is hardcoded.

An existing branch is reused only when its canonical slug and normalized name both match unambiguously and it is a compatible Executive record. Its UUID, content, files, display position and publication status are retained; an existing draft is not automatically published. Conflicting names, slugs, aliases, parent candidates or archived identities abort the transaction for review rather than choosing or renaming a record.

No staff account, membership, content ownership or file reference is migrated to another identity. Permanent department deletion remains blocked. During SQL Editor seeding, the migration locks departments and temporarily suspends only `z_reorder`, whose authorization requires a staff session. Existing identity, hierarchy, audit, timestamp and FK checks remain active. It checks preserved records, finishes deferred position checks, restores the ordering trigger, and protects the new parent identity field before committing. A failure rolls the entire operation back.

## Validation

`tests/data/department-branches.spec.ts` runs the real migration chain through 034 in an isolated PGlite database. It checks conflict and late-preservation rollback, reuse of an existing draft with retained content/images/membership, new published profiles, trigger restoration, separate parent/child permissions, viewer limits, forged parent changes, invalid hierarchy relationships, anonymous visibility, parent archival and editing, aliases/contacts, news/program source links, assignment revocation, and unchanged top-level Legislative contact policy behavior.

`tests/data/department-branch-parents.spec.ts` checks parent-selector pagination under a lower server row cap, missing exact counts, later-page errors, self/workspace/branch filtering, inactive parents, and preserving only the current archived relationship.

Run the focused SQL checks with:

```sh
npx playwright test --config playwright.data.config.ts tests/data/department-branches.spec.ts
```

Local SQL tests do not verify hosted migration state. Apply 034 manually and verify the three profiles and parent relationships in the website before assigning staff or adding branch content.
