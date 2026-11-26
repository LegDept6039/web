# Legislative seed review

Source: corrected seeding1ordinance202052026 workbook, Sheet1. Row numbers below are Excel row numbers. Checked against the configured CMS with read-only GET requests on November 26, 2026.

## Scope and completed checks

- User approved seeding 210 ready documents: 69 ordinances and 141 resolutions. The title will serve as the temporary summary/body.
- These 210 documents represent 212 Excel rows after two exact duplicate pairs are consolidated (103/107 and 624/625). The other 446 rows remain on hold in the companion manifest.
- Rows 501 and 537 are excluded as requested: Resolution No. 063-2026 and Resolution No. 101-2026.
- 656 source rows remain: 175 ordinance rows and 481 resolution rows. These are source-row counts, not final document counts.
- Dates span July 1, 2025 to November 9, 2026. Every row maps to the existing 17th term.
- Every author, optional co-author, and term-specific committee resolves to one existing registered record. Names and IDs in the database are preserved.
- Applied and verified on November 26, 2026: 69 ordinances and 141 resolutions added, with all 210 publicly visible. The preexisting documents and reference rows remain unchanged.

## Approved seed

Run the contents of `supabase/imports/20261126_legislative_documents_ready.sql` in Supabase SQL Editor after migration 037. The companion `20261126_legislative_documents_ready_manifest.json` lists every included document and every held source row with its reasons.

The seed resolves the existing 17th-term officials, committees and same-date sessions at execution time. It inserts published, approved documents, preserves existing records and references, skips exact matches on reruns, and aborts the transaction on a changed or ambiguous reference or document conflict. It creates no sessions or other reference records.

Eight local SQL tests passed against migrations 001-037, including exact content/reference checks, preservation, rollback failures and an unchanged rerun. An independent audit also compared all 210 SQL tuples to the workbook and verified coverage of all 658 source rows.

### Hosted verification

The user confirmed SQL Editor completed successfully. Read-only hosted checks found exactly 69 new ordinances and 141 new resolutions, for totals of 74 and 142. All imported content, authors, co-authors, committees, same-date sessions, terms and office references match. The preexisting 15 terms, 162 officials, 375 committees, 26 sessions, five ordinances and one resolution remain unchanged. No held-only identity was added. A separate unauthenticated API check confirmed public visibility of every imported document.

SQL Editor stored CRLF line endings in all 210 titles and summaries. Only newline encoding differs from the source; all other characters and line-break positions match. Each saved summary exactly equals its saved title. The source is otherwise retained without editorial corrections to legal text.

See [hosted-verification.json](hosted-verification.json) for the verification summary. The 446 held source rows remain outside this seed.

## Remaining review items

1. **Duplicate numbers:** 32 pairs are exact duplicates. Keep each exact record once. Another 25 pairs have conflicting details and need a corrected number or an authoritative row choice. Do not choose an author/title by guesswork.
2. **Existing records:** Four source document numbers already exist in the CMS. Compare the records below before reusing, changing, or excluding them; their IDs and references must be preserved.
3. **Sessions:** 437 rows have no existing same-date session, covering 46 dates. The current database requires a real session with the same date, term, and Legislative office. The workbook does not provide session names, numbers, or types.
4. **Full text and attachments:** Every BODY cell is a formula returning only “Ordinance” or “Resolution”. The user approved the title as the temporary summary for this seed. No full text, hyperlink or PDF attachment was supplied.
5. **Multiple co-authors:** Rows 501 and 537 remain parked as requested. No co-author has been dropped from either source row.

After exact duplicates are consolidated, the 656 rows outside the parked pair contain 599 distinct type/number/year groups, including the 25 conflicting groups. The approved seed includes 210 unconflicted groups with matching sessions. Held reasons can overlap; their counts must not be added together.

### Additional number-format candidates

These are already held for missing sessions. Review their numbers before a future batch; no automatic merge or renumbering was made.

- Excel rows 32/33: Ordinance 92-2025 and 092-2025, with a short versus full title.
- Excel rows 85/86: Ordinance AO1-2026 and AO#1-2026, with similar titles.

## Conflicting source document numbers

| Document | Excel rows | Differing fields |
| --- | --- | --- |
| Ordinance No. 082-2025 | 20, 22 | title |
| Ordinance No. 099-2026 | 145, 146 | title, committee, author |
| Ordinance No. 117-2026 | 163, 164 | title |
| Resolution No. 111-2025 | 210, 217 | date |
| Resolution No. 128-2025 | 234, 248 | title |
| Resolution No. 138-2025 | 243, 258 | title |
| Resolution No. 142-2025 | 262, 291 | coauthor |
| Resolution No. 145-2025 | 265, 294 | title |
| Resolution No. 146-2025 | 266, 295 | title |
| Resolution No. 148-2025 | 268, 297 | coauthor |
| Resolution No. 149-2025 | 269, 298 | coauthor |
| Resolution No. 150-2025 | 270, 299 | coauthor |
| Resolution No. 151-2025 | 271, 300 | coauthor |
| Resolution No. 152-2025 | 272, 301 | coauthor |
| Resolution No. 153-2025 | 273, 302 | coauthor |
| Resolution No. 154-2025 | 274, 303 | coauthor |
| Resolution No. 155-2025 | 275, 304 | coauthor |
| Resolution No. 156-2025 | 276, 305 | coauthor |
| Resolution No. 157-2025 | 277, 306 | coauthor |
| Resolution No. 158-2025 | 278, 307 | coauthor |
| Resolution No. 159-2025 | 279, 308 | coauthor |
| Resolution No. 160-2025 | 280, 309 | coauthor |
| Resolution No. 161-2025 | 281, 310 | coauthor |
| Resolution No. 162-2025 | 282, 311 | coauthor |
| Resolution No. 129-2026 | 545, 563 | title, committee, author, date |

### Ordinance No. 082-2025 — rows 20 / 22

**Row 20**

- title: AN ORDINANCE AMENDING CHAPTER IV, ARTICLE A, SECTION 4A.07 OF ORDINANCE NO. 032-2023, &#1058;&#1054; PROVIDE LOWER RENTAL FEES FOR CADRE STALLS DURING HOLIDAYS AND SCHOOL VACATIONS, AND INSERTING A NEW SECTION 4A.08 TO PROVIDE FOR THE COLLECTION OF CASH TICKETS ON THE SALE OF LIVESTOCK DURING MARKET DAY WITH GUIDELINES ON THEIR ISSUANCE, AND FOR OTHER PURPOSES

**Row 22**

- title: AN ORDINANCE AMENDING CHAPTER IV, ARTICLE A, SECTION 4A.07 OF ORDINANCE NO. 032-2023, TO PROVIDE LOWER RENTAL FEES FOR CADRE STALLS DURING HOLIDAYS AND SCHOOL VACATIONS, AND INSERTING A NEW SECTION 4A.08 TO PROVIDE FOR THE COLLECTION OF CASH TICKETS ON THE SALE OF LIVESTOCK DURING MARKET DAY WITH GUIDELINES ON THEIR ISSUANCE, AND FOR OTHER PURPOSES

### Ordinance No. 099-2026 — rows 145 / 146

**Row 145**

- title: AN ORDINANCE ESTABLISHING A CASHLESS PAYMENT INCENTIVES AND REWARDS PROGRAM FOR BUSINESS ESTABLISHMENT IN THE PUBLIC MARKET OF THE MUNICIPALITY OF PINAMUNGAJAN, PROVIDING INCENTIVES THEREFOR, AND OTHER PURPOSES
- committee: COMMITTEE ON TRADE, COMMERCE AND INDUSTRY, TRANSPORTATION AND COMMUNICATION
- author: Hon. Julius Erwin T. Alpas

**Row 146**

- title: AN ORDINANCE PROHIBITING THE SALE, SERVING, GIVING, DISPENSING, OR OTHERWISE PROVIDING OF ALCOHOLIC OR INTOXICATING BEVERAGES TO MINORS, RESTRICTING THE PURCHASE, POSSESSION, AND CONSUMPTION THEREOF BY MINORS, REQUIRING AGE VERIFICATION BY SELLERS AND ESTABLISHMENTS, PROVIDING PENALTIES FOR VIOLATIONS, AND FOR OTHER PURPOSES IN THE MUNICIPALITY OF PINAMUNGAJAN, CEBU
- committee: COMMITTEE ON WOMEN AND FAMILY CONCERNS, SOCIAL SERVICES, MARGINALIZED SECTORS
- author: Hon. Maria Elena C. Limocon

### Ordinance No. 117-2026 — rows 163 / 164

**Row 163**

- title: AN ORDINANCE AMENDING ITEM NO. 9, PARAGRAPH (H), SIGN FEES, OF ARTICLE M, SECTION 3M.02.01 UNDER THE "SCHEDULE OF FEES AND OTHER CHARGES" OF ORDINANCE NO. 033-2023, OTHERWISE KNOWN AS "AN ORDINANCE ENACr1NG THE 2023 REVISED REVENUE CODE OF THE MUNICIPALITY OF PINAMUNGAJAN, CEBU," PRESCRIBING UPDATED FEES, PERMIT PERIODS, ENFORCEMENT PROCEDURES, AND PENALTIES FOR SIGN DISPLAYS

**Row 164**

- title: AN ORDINANCE AMENDING ITEM NO. 9, PARAGRAPH (H), SIGN FEES, OF ARTICLE M, SECTION 3M.02.01 UNDER THE "SCHEDULE OF FEES AND OTHER CHARGES" OF ORDINANCE NO. 033-2023, OTHERWISE KNOWN AS "AN ORDINANCE ENACTING THE 2023 REVISED REVENUE CODE OF THE MUNICIPALITY OF PINAMUNGAJAN, CEBU," PRESCRIBING UPDATED FEES, PERMIT PERIODS, ENFORCEMENT PROCEDURES, AND PENALTIES FOR SIGN DISPLAYS

### Resolution No. 111-2025 — rows 210 / 217

**Row 210**

- date: 2025-08-11

**Row 217**

- date: 2025-08-18

### Resolution No. 128-2025 — rows 234 / 248

**Row 234**

- title: A RESOLUTION APPROVING AND DECLARING OPERATIVE THE SUPPLEMENTAL BUDGET NO. 1 OF BARANGAY SIBAGO

**Row 248**

- title: A RESOLUTION APPROVING AND DECLARING OPERATIVE THE SUPPLEMENTAL BUDGET NO. 1 OF BARANGAY SIBAG

### Resolution No. 138-2025 — rows 243 / 258

**Row 243**

- title: A RESOLUTION APPROVING AND GRANTING THE ACCREDITATION OF GUARDIANS PANTHERS BROTHERHOOD MAINSTREAM INTERNATIONAL, INCORPORATED IN THE MUNICIPALITY OF PINAMUNGAJAN

**Row 258**

- title: A RESOLUTION APPROVING AND GRANTING THE ACCREDITATION OF GUARDIANS PANTHERS BROTHERHOOD MAINSTREAM INTERNATIONAL, INCORPORATED IN THE MUNICIPALITY OF PINAMUNGAJANc

### Resolution No. 142-2025 — rows 262 / 291

**Row 262**

- coauthor: Hon. Richard M. Canillo

**Row 291**

- coauthor: Hon. Julius Erwin T. Alpas

### Resolution No. 145-2025 — rows 265 / 294

**Row 265**

- title: A RESOLUTION APPROVING AND DECLARING OPERATIVE THE SUPPLEMENTAL BUDGET NO. 2 OF BARANGAY BINABA

**Row 294**

- title: A RESOLUTION APPROVING AND DECLARING OPERATIVE THE SUPPLEMENTAL BUDGET NO. 2 OF BARANGAY BINABAG

### Resolution No. 146-2025 — rows 266 / 295

**Row 266**

- title: A RESOLUTION ADOPTING THE FY 2026 ANNUAL CULTURAL PLAN OF TH&#1045; MUNICIPALITY OF PINAMUNGAJAN

**Row 295**

- title: A RESOLUTION ADOPTING THE FY 2026 ANNUAL CULTURAL PLAN OF TH&#1045; MUNICIPALITY OF PINAMUNGAJA

### Resolution No. 148-2025 — rows 268 / 297

**Row 268**

- coauthor: (blank)

**Row 297**

- coauthor: Hon. Jesus M. Managaytay

### Resolution No. 149-2025 — rows 269 / 298

**Row 269**

- coauthor: (blank)

**Row 298**

- coauthor: Hon. Joey D. Indino

### Resolution No. 150-2025 — rows 270 / 299

**Row 270**

- coauthor: (blank)

**Row 299**

- coauthor: Hon. Jose A. Alqueza

### Resolution No. 151-2025 — rows 271 / 300

**Row 271**

- coauthor: (blank)

**Row 300**

- coauthor: Hon. Jesus M. Managaytay

### Resolution No. 152-2025 — rows 272 / 301

**Row 272**

- coauthor: (blank)

**Row 301**

- coauthor: Hon. Jose A. Alqueza

### Resolution No. 153-2025 — rows 273 / 302

**Row 273**

- coauthor: (blank)

**Row 302**

- coauthor: Hon. Jose A. Alqueza

### Resolution No. 154-2025 — rows 274 / 303

**Row 274**

- coauthor: (blank)

**Row 303**

- coauthor: Hon. Jesus M. Managaytay

### Resolution No. 155-2025 — rows 275 / 304

**Row 275**

- coauthor: (blank)

**Row 304**

- coauthor: Hon. Marvin M. Miralles

### Resolution No. 156-2025 — rows 276 / 305

**Row 276**

- coauthor: (blank)

**Row 305**

- coauthor: Hon. Jose A. Alqueza

### Resolution No. 157-2025 — rows 277 / 306

**Row 277**

- coauthor: (blank)

**Row 306**

- coauthor: Hon. Julius Erwin T. Alpas

### Resolution No. 158-2025 — rows 278 / 307

**Row 278**

- coauthor: (blank)

**Row 307**

- coauthor: Hon. Annette J. Navarro

### Resolution No. 159-2025 — rows 279 / 308

**Row 279**

- coauthor: (blank)

**Row 308**

- coauthor: Hon. Joey D. Indino

### Resolution No. 160-2025 — rows 280 / 309

**Row 280**

- coauthor: (blank)

**Row 309**

- coauthor: Hon. Annette J. Navarro

### Resolution No. 161-2025 — rows 281 / 310

**Row 281**

- coauthor: (blank)

**Row 310**

- coauthor: Hon. Marvin M. Miralles

### Resolution No. 162-2025 — rows 282 / 311

**Row 282**

- coauthor: (blank)

**Row 311**

- coauthor: Hon. Julius Erwin T. Alpas

### Resolution No. 129-2026 — rows 545 / 563

**Row 545**

- title: A RESOLUTION EARNESTLY REQUESTING FINANCIAL ASSISTANCE FROM THE OFFICE OF SENATOR JOSEPH VICTOR “JV" EJERCITO FOR THE REHABILITATION AND IMPROVEMENT OF THE PINAMUNGAJAN PUBLIC MARKET IN THE AMOUNT OF TEN MILLION PESOS (P10,000,000.00)
- committee: COMMITTEE ON INFRASTRUCTURE AND PUBLIC WORKS
- author: Hon. Maria Elena C. Limocon
- date: 2026-06-22

**Row 563**

- title: A RESOLUTION APPROVING BARANGAY SIBAGO ORDINANCE NO. 02-2026 - BUDGET AUGMENTATION INVOLVING AN AMOUNT OF FORTY-ONE THOUSAND EIGHT HUNDRED PESOS (P 41,800.00)
- committee: COMMITTEE ON FINANCE, BUDGET AND APPROPRIATION
- author: Hon. Julius Erwin T. Alpas
- date: 2026-07-13

## Existing CMS number conflicts

### Ordinance No. 01-2026 — Excel row 56

**Spreadsheet:** AN ORDINANCE AMENDING CHAPTER II, SECTIONS 5 AND 6 OF MUNICIPAL ORDINANCE NO. 163-2018, AS AMENDED BY ORDINANCE NOS. 048-2022 AND 051-2022, OTHERWISE KNOWN AS "THE SANITATION CODE OF THE MUNICIPALITY OF PINAMUNGAJAN, CEBU,” IN ORDER TO RATIONALIZE AND STREAMLINE LABORATORY AND DIAGNOSTIC TEST REQUIREMENTS FOR THE ISSUANCE AND RENEWAL OF HEALTH CERTIFICATES AND SANITARY PERMITS, IN ACCORDANCE WITH LOCAL HEALTH BOARD RESOLUTION NO. 2025-022

Date: 2026-01-05; author: Hon. Marvin M. Miralles; co-author: Hon. Maria Elena C. Limocon.

**Existing CMS record:** Establishing community water safety standards

ID: `water-safety`; date: 2026-01-20; term: (unassigned); published: true; sample: true.

Saved author: Sample Council Member A; author reference: (none); co-author: ; co-author reference: (none).

### Ordinance No. 02-2026 — Excel row 57

**Spreadsheet:** AN ORDINANCE REGULATING AND PENALIZING MOTOR SHOP OWNERS AND MOTORCYCLE MECHANICS WHO INSTALL, FABRICATE, MODIFY, OR SELL, “BORABORA," OPEN PIPE, OR OTHER NOISY AND NON-COMPLIANT MUFFLERS ON MOTORCYCLES WITHIN THE MUNICIPALITY OF PINAMUNGAJAN, PROVINCE OF CEBU

Date: 2026-01-12; author: Hon. Marvin M. Miralles; co-author: Hon. Jesus M. Managaytay.

**Existing CMS record:** Strengthening barangay solid waste management

ID: `solid-waste`; date: 2026-03-16; term: (unassigned); published: true; sample: true.

Saved author: Sample Council Member B; author reference: (none); co-author: ; co-author reference: (none).

### Ordinance No. 03-2026 — Excel row 58

**Spreadsheet:** AN ORDINANCE ESTABLISHING COMPREHENSIVE GUIDELINES, PROCEDURES AND FEES FOR THE APPROVAL AND ISSUANCE OF LAND DEVELOPMENT PERMIT FOR NONSUBDIVISION PROJECTS AND OUTSIDE THE PURVIEW OF PRESIDENTIAL DECREEE 957 (SUBDIVISION AND CONDOMINIUM BUYER’S PROTECTIVE DECREE) AND BATAS PAMBANSA 220 (ECONOMIC AND SOCIALIZED HOUSING) SUCH AS TOURISM FACILITIES, ECO-PARKS, BEACH AND MOUNTAIN RESORTS, FISHPONDS, AQUACULTURE, PIGGERY, AND POULTRY PROJECTS, COMMERCIAL PROJECTS, ARCADES, INDUSTRIAL DEVELOPMENTS, PROCESSING PLANTS IN THE MUNICIPALITY OF PINAMUNGAJAN, CEBU, PROVIDING PENALTIES FOR VIOLATION THEREOF.

Date: 2026-01-19; author: Hon. Annette J. Navarro; co-author: Hon. Marvin M. Miralles.

**Existing CMS record:** Supporting local micro and small enterprises

ID: `local-enterprise`; date: 2026-06-08; term: (unassigned); published: true; sample: true.

Saved author: Sample Council Member C; author reference: (none); co-author: ; co-author reference: (none).

### Resolution No. 097-2025 — Excel row 198

**Spreadsheet:** A RESOLUTION GRANTING FAVORABLE ENDORSEMENT TO THE APPLICATION OF MR. LEOCADIO PARAGADOS FOR THE RENEWAL OF HIS QUARRY PERMIT COVERING AN AREA OF MORE OR LESS FORTY-ONE THOUSAND ONE HUNDRED THIRTY-ONE (41,131) SQUARE METERS LOCATED IN PUROK ORCHIDS, BARANGAY ANISLAG, PINAMUNGAJAN, CEBU

Date: 2025-08-04; author: Hon. Annette J. Navarro; co-author: Hon. Julius Erwin T. Alpas.

**Existing CMS record:** A RESOLUTION GRANTING FAVORABLE ENDORSEMENT TO THE APPLICATION OF MR. LEOCADIO PARAGADOS FOR THE RENEWAL OF HIS QUARRY PERMIT COVERING AN AREA OF MORE OR LESS FORTY-ONE THOUSAND ONE HUNDRED THIRTY-ONE (41,131) SQUARE METERS LOCATED IN PUROK ORCHIDS, BARANGAY ANISLAG, PINAMUNGAJAN, CEBU

ID: `c01ca606-c8cc-4d5b-bc68-30a7f563127e`; date: 2025-08-04; term: 4a551127-9393-41b8-8b55-e42c88279751; published: true; sample: false.

Saved author: ; author reference: secretariat; co-author: ; co-author reference: 1.

## Missing session dates

| Date | Source rows affected |
| --- | --- |
| 2025-07-01 | 177, 178, 179 |
| 2025-07-07 | 180, 181, 182, 183 |
| 2025-07-14 | 3, 4, 5, 6, 7, 8, 184, 185, 186, 187, 188 |
| 2025-07-21 | 9, 10, 11, 189, 190 |
| 2025-07-28 | 12, 13, 14, 191, 192, 193, 194, 195 |
| 2025-08-11 | 15, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214 |
| 2025-08-18 | 16, 215, 216, 217, 218 |
| 2025-09-01 | 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232 |
| 2025-09-08 | 17, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255, 256, 257, 258, 259, 260 |
| 2025-09-22 | 18, 19, 261, 262, 263, 264, 265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 290, 291, 292, 293, 294, 295, 296, 297, 298, 299, 300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 318 |
| 2025-09-29 | 20, 21, 22, 319, 320, 321, 322, 323, 324, 325, 326, 327, 328, 329, 330, 331, 332, 333 |
| 2025-10-01 | 23, 24 |
| 2025-10-06 | 25, 26, 27, 28, 29, 334, 335, 336, 337, 338, 339, 340, 341, 342, 343, 344, 345, 346 |
| 2025-10-13 | 30, 31, 347, 348, 349, 350, 351, 352, 353 |
| 2025-10-20 | 32, 33, 34, 354, 355, 356, 357, 358, 359, 360, 361, 362, 363, 364, 365, 366 |
| 2025-10-27 | 35, 367, 368, 369, 370, 371, 372, 373 |
| 2025-11-03 | 36, 374, 375, 376, 377, 378, 379 |
| 2025-11-10 | 37, 380, 381, 382, 383, 384, 385, 386, 387 |
| 2025-11-17 | 38, 39, 40, 41, 388, 389, 390, 391, 392 |
| 2025-11-24 | 42, 43, 44, 393, 394, 395, 396, 397, 398 |
| 2025-12-01 | 45, 46, 47, 48, 399, 400, 401, 402, 403, 404, 405 |
| 2025-12-09 | 49, 406 |
| 2025-12-15 | 50, 51, 52, 53, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418 |
| 2025-12-22 | 54, 55, 419, 420, 421, 422, 423, 424, 425, 426, 427, 428, 429, 430, 431, 432, 433, 434, 435, 436 |
| 2025-12-26 | 437, 438, 439 |
| 2026-01-05 | 56, 440, 441, 442, 443 |
| 2026-01-12 | 57, 444, 445, 446, 447 |
| 2026-01-19 | 58, 59, 60, 61, 62, 448, 449, 450 |
| 2026-01-26 | 451, 452, 453, 454, 455, 456 |
| 2026-02-02 | 63, 64, 457, 458, 459, 460, 461 |
| 2026-02-09 | 65, 66, 67, 68, 69, 70, 71, 462, 463 |
| 2026-02-16 | 464 |
| 2026-02-23 | 72, 73, 74, 75, 76, 465 |
| 2026-03-02 | 77, 78, 79, 466, 467, 468, 469, 470 |
| 2026-03-09 | 80, 81, 471, 472, 473, 474 |
| 2026-03-16 | 82, 83, 84, 85, 86, 475, 476, 477, 478, 479, 480, 481, 482, 483 |
| 2026-03-23 | 87, 88, 89, 484, 485, 486, 487, 488, 489 |
| 2026-03-30 | 90, 490, 491, 492, 493, 494, 495, 496 |
| 2026-04-06 | 91, 92, 497, 498, 499, 500 |
| 2026-04-13 | 502 |
| 2026-04-20 | 93, 94, 95, 96, 97, 503, 504 |
| 2026-04-27 | 505, 506, 507, 508 |
| 2026-05-04 | 509 |
| 2026-05-11 | 98, 99, 100, 101, 510, 511, 512, 513, 514, 515 |
| 2026-05-18 | 102, 516, 517, 518, 519 |
| 2026-07-29 | 139 |

## Exact duplicates to consolidate once

| Document | Excel rows |
| --- | --- |
| Ordinance No. 048-2026 | 103, 107 |
| Resolution No. 083-2025 | 186, 188 |
| Resolution No. 101-2025 | 202, 214 |
| Resolution No. 102-2025 | 203, 213 |
| Resolution No. 103-2025 | 204, 212 |
| Resolution No. 112-2025 | 215, 218 |
| Resolution No. 117-2025 | 219, 224 |
| Resolution No. 127-2025 | 233, 247 |
| Resolution No. 129-2025 | 235, 249 |
| Resolution No. 130-2025 | 236, 250 |
| Resolution No. 131-2025 | 237, 251 |
| Resolution No. 133-2025 | 238, 253 |
| Resolution No. 134-2025 | 239, 254 |
| Resolution No. 135-2025 | 240, 255 |
| Resolution No. 136-2025 | 241, 256 |
| Resolution No. 137-2025 | 242, 257 |
| Resolution No. 139-2025 | 244, 259 |
| Resolution No. 140-2025 | 245, 260 |
| Resolution No. 141-2025 | 261, 290 |
| Resolution No. 143-2025 | 263, 292 |
| Resolution No. 144-2025 | 264, 293 |
| Resolution No. 147-2025 | 267, 296 |
| Resolution No. 163-2025 | 283, 312 |
| Resolution No. 164-2025 | 284, 313 |
| Resolution No. 165-2025 | 285, 314 |
| Resolution No. 166-2025 | 286, 315 |
| Resolution No. 167-2025 | 287, 316 |
| Resolution No. 168-2025 | 288, 317 |
| Resolution No. 169-2025 | 289, 318 |
| Resolution No. 170-2025 | 319, 320 |
| Resolution No. 040-2026 | 475, 477 |
| Resolution No. 202-2026 | 624, 625 |

Every source row is represented by an included document or a held entry in the manifest. The held entries remain outside this seed; no missing session details or conflicting document fields are inferred.
