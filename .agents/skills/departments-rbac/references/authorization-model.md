# Live authorization contract

Paths are repository-relative. Read `lib/auth/server.ts`, `lib/offices/{permissions,server,collections}.ts`, relevant actions and SQL policies.

`auth.getUser()` -> active, nondeleted `staff_accounts` -> `user_office_access` memberships -> active/nonarchived canonical `departments`. `office_id` references Department UUIDs. `requireStaff(true, true)` guards privileged writable actions; `officeContext(true)` supplies content-action context. `allowed`, `available`, `contentAllowed` combine account role, membership level, branch and ownership. Proxy refresh is not the sole guard.

| Operation | Current rule |
| --- | --- |
| Read assigned staff content | Membership plus active account/department; viewer remains read-only |
| Write assigned content | Account admin/editor AND membership editor/manager |
| General delete | Account admin AND membership manager |
| Executive news/program/contact delete | Uses write permission, so assigned editors can delete these |
| Department create/identity/publication/order/active/access | Active Superadmin only |
| Department delete | Denied even to Superadmin; deactivate instead |

Migration 010 protects name, short_name, slug, published, sort_order, is_sample and existing identity/access fields. Branch cannot change after creation, even for Superadmin. Editors may change assigned description, body, head details, department/head images and owned news/programs/contacts. Generic department content actions reject identity mutations even for Superadmin; use the system-management form.

Office Access options come from active Department records. Saving a user aligns selected membership levels with the account role; inactive selections are removed with a notice. Do not replace this with a single department_id or invent `profiles`/`user_departments` tables.

Legislative Access uses the same membership mechanism. Public official roles are separate content enums. `branchAllows` expresses branch-level collection availability, not configurable per-user modules. Admin list queries explicitly filter assigned IDs even when RLS also permits public reads of other departments.

RLS and trigger denials use SQLSTATE 42501 (PostgREST 403). Server Actions return inline permission errors; unauthorized admin pages keep existing not-found/redirect behavior. Preserve optimistic `updated_at` checks and server-owned upload paths. Auth Admin provisioning uses a server-only credential; content writes retain the user's session/RLS.
