# Historical council seed

Run the **contents** of [the SQL seed](../supabase/imports/20261126_historical_council_officials.sql) in Supabase SQL Editor after migration 036. This is a one-time content import, not a schema migration. Do not rerun the original `supabase/seed.sql` on this database.

The supplied roster contains 162 council entries for 15 periods, from 1982–1986 through 2025–2028. A read-only preflight on November 26, 2026 found 13 existing matches: the 11 current officials plus Glenn F. Baricuatro and Marcelo T. Gerongco in 2022–2025. On that state, the import adds 149 published officials and reuses those 13 unchanged.

| Period | Council entries | Existing matches | New officials |
| --- | ---: | ---: | ---: |
| 1982–1986 | 12 | 0 | 12 |
| 1986–1989 | 11 | 0 | 11 |
| 1989–1992 | 10 | 0 | 10 |
| 1992–1995 | 10 | 0 | 10 |
| 1995–1998 | 11 | 0 | 11 |
| 1998–2001 | 11 | 0 | 11 |
| 2001–2004 | 11 | 0 | 11 |
| 2004–2007 | 11 | 0 | 11 |
| 2007–2010 | 11 | 0 | 11 |
| 2010–2013 | 11 | 0 | 11 |
| 2013–2016 | 10 | 0 | 10 |
| 2016–2019 | 10 | 0 | 10 |
| 2019–2022 | 11 | 0 | 11 |
| 2022–2025 | 11 | 2 | 9 |
| 2025–2028 | 11 | 11 | 0 |
| **Total** | **162** | **13** | **149** |

## Terms and roles

Existing terms are resolved by exact July 1 start and June 30 end dates, independent of their display names. All existing term names and IDs stay intact. The user authorized creating the missing **1982–1986** term with dates `1982-07-01` to `1986-06-30`. Its normal migration-036 trigger also generates its published Master Committee compositions. All other terms must already exist with the exact dates; the seed stops if they do not.

The 14 Vice-Mayors use `MUNICIPAL_VICE_MAYOR`. The other 148 entries use `SANGGUNIANG_BAYAN`, including 13 ABC/Liga presidents and 10 SK/SKF presidents. New SB records display the position **Sangguniang Bayan**. The ABC/Liga or SKF position appears in their description. Existing position/description text is preserved.

The unheaded roster following 2022–2025 is treated as 2025–2028 because its 11 officials match the registered current council. The separate 1982–1986 Mayor entry is excluded from this legislative import. No Vice-Mayor is invented for 2013–2016, and no SK president is invented for 2016–2019. Mario Gaviola and Dulce Yap retain the supplied `1986-1987` service note; no exact service dates are inferred.

## Identity and preservation

Same-term matching ignores honorifics, periods, whitespace, case and the ñ/n difference. The current roster's `Juluis Erwin T. Alpas` explicitly accepts registered `Julius Erwin Alpas` and `Julius Erwin T. Alpas`; Lorenzo Ninal accepts Niñal. The registered records retain their names and IDs. Other spelling variants, such as Oradaniza/Ordaniza and Lapasan/Laparan in different terms, remain as supplied. Names such as Juanito Moñasque retain UTF-8 characters.

An official serving in several terms needs a separate record per term under the existing model. The import never transfers an official across terms or guesses the identity of an unassigned record. Ambiguous matches, role/office mismatches, unassigned name collisions, a conflicting Vice-Mayor or unexpected trigger state stop the entire transaction for review.

The import appends new published records without moving saved officials. Existing officials, terms and committees are checked against complete before/after JSON snapshots. Memberships, document authorship/references, photos, publication, order and creation metadata remain intact. Only the officials ordering trigger is briefly suspended while holding an exclusive table lock; term, ownership, audit, foreign-key and deferred position checks stay active. Failure rolls back the full import, including the optional term creation. Rerunning skips existing matches.

New officials have no uploaded photo or invented biography. The historical directory continues to use its existing table layout.

## Verification

Local SQL validation and hosted execution are separate. The preflight above only read hosted data; this document does not imply that the import has been executed.

Six real SQL tests passed against migrations 001–036 in PGlite (`tests/data/historical-council-seed.spec.ts`). They verify 149 inserts and 13 reuses, all 15 date ranges, the new term and its 25 published committees, unchanged records/photos/relationships/policies, ABC/SK roles, UTF-8 names, partial-service notes and a no-op rerun. Deliberate role/date/identity/trigger conflicts and an injected midway insert failure roll back all officials, the new term, generated committees and audit writes. Scoped ESLint passed. An independent source audit matched all 162 SQL roster rows to the attachment.
