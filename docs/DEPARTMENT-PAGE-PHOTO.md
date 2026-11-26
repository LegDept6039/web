# Department page portrait preference (migration 035)

Apply the **contents** of `supabase/migrations/202611250035_department_page_photo.sql` in Supabase SQL Editor after migration 034, then deploy the matching application. Implementation has not applied this migration to the hosted database.

The department content editor includes **Show head photo on this department page**. An assigned editor or Superadmin can turn it off to hide the department head portrait only on `/departments/[slug]`. The head name, title and biography remain visible and use the available width. The `/departments` directory continues showing its existing portrait or fallback; it has no opt-out. Branch banner images are also unaffected.

The migration adds `departments.show_head_photo_on_page`, a non-null boolean with a default of `true`. Existing and new departments therefore continue showing their portrait unless an authorized editor changes the preference. Application decoding also accepts older records without the field and treats a missing preference as shown.

No existing row is updated by the migration. Department IDs, slugs and aliases, parent relationships, publication and ordering, descriptions, staff memberships, images, timestamps, and audit history are preserved. Hiding a portrait retains the `head_photo` URL and stored image, so enabling it again restores the same portrait. The preference uses existing department edit permissions; it does not grant access to another office or let viewers write.

`tests/data/department-page-photo.spec.ts` runs the real migration chain through 035 in isolated PGlite. It checks preservation of existing records, memberships, media and triggers; true defaults for existing and new departments; rejected null values; authorized opt-out/restore with retained media; viewer and cross-office write restrictions; and optional boolean decoding. These are local results, separate from hosted verification.

Run the focused checks with:

```sh
npx playwright test --config playwright.data.config.ts tests/data/department-page-photo.spec.ts
```
