-- One-time historical council content seed requested on 2026-11-26.
-- Run these contents in Supabase SQL Editor after migration 036.
-- 162 council entries across 15 periods (1982-2028). Reuses same-term officials;
-- creates only missing officials, published, with no invented photos or people.
-- ABC/Liga and SK/SKF presidents use SANGGUNIANG_BAYAN, with their supplied
-- positions retained in the description. Vice-Mayors use MUNICIPAL_VICE_MAYOR.
-- The user authorized creating the missing 1982-1986 term (July 1-June 30).
-- Its normal migration-036 trigger also creates its published committee list.
-- All other terms must already exist with exact dates; term names are preserved.
-- The final unheaded roster is the registered 2025-2028 council. Its Juluis/Julius
-- and Lorenzo Ninal/Niñal variants explicitly reuse the registered identities.
-- Honorifics, case, spaces, periods and ñ are normalized only for matching.
-- Other supplied spellings remain as written. No fuzzy or cross-term merging.
-- No Vice-Mayor was supplied for 2013-2016; no SK president for 2016-2019.
-- Gaviola and Yap retain the source's 1986-1987 service note. The separate
-- 1982-1986 Mayor entry is Executive content and is excluded from this roster.
-- Existing officials, terms, committee roles, documents, IDs, publication,
-- ordering, photos, authorship, staff access and permissions remain unchanged.
-- Safe to rerun: existing matches are skipped. Ambiguous identities abort.
begin;
lock table public.legislative_terms,public.officials,public.committees in access exclusive mode;
lock table public.departments,public.committee_master in share mode;

create temporary table portal_council_seed_context (office_id uuid not null) on commit drop;
create temporary table portal_council_officials_before on commit drop as
 select id,to_jsonb(o) as original from public.officials o;
create temporary table portal_council_terms_before on commit drop as
 select id,to_jsonb(t) as original from public.legislative_terms t;
create temporary table portal_council_committees_before on commit drop as
 select id,to_jsonb(c) as original from public.committees c;
create temporary table portal_council_roster (
 sequence integer primary key,
 start_date date not null,
 end_date date not null,
 source_name text not null,
 name text not null,
 category text not null check(category in ('vice_mayor','sb','abc','sk')),
 description text not null,
 name_aliases text[] not null,
 term_id uuid,
 official_id text,
 existing boolean not null default false
) on commit drop;
insert into portal_council_roster(sequence,start_date,end_date,source_name,name,category,description,name_aliases) values
 (1,date '1986-07-01',date '1989-06-30','Hon. Apolonio M. Ygay Sr.','Hon. Apolonio M. Ygay Sr.','vice_mayor','',array['Hon. Apolonio M. Ygay Sr.']),
 (2,date '1986-07-01',date '1989-06-30','Hon. Mario Mercado','Hon. Mario Mercado','sb','',array['Hon. Mario Mercado']),
 (3,date '1986-07-01',date '1989-06-30','Hon. Mario Gaviola','Hon. Mario Gaviola','sb','Service period listed: 1986-1987.',array['Hon. Mario Gaviola']),
 (4,date '1986-07-01',date '1989-06-30','Hon. Francisco L. Bellones','Hon. Francisco L. Bellones','sb','',array['Hon. Francisco L. Bellones']),
 (5,date '1986-07-01',date '1989-06-30','Hon. Vicente Taping','Hon. Vicente Taping','sb','',array['Hon. Vicente Taping']),
 (6,date '1986-07-01',date '1989-06-30','Hon. Antonio Talaid','Hon. Antonio Talaid','sb','',array['Hon. Antonio Talaid']),
 (7,date '1986-07-01',date '1989-06-30','Hon. Onofre G. Generalao','Hon. Onofre G. Generalao','sb','',array['Hon. Onofre G. Generalao']),
 (8,date '1986-07-01',date '1989-06-30','Hon. Pedro I. Moreno','Hon. Pedro I. Moreno','sb','',array['Hon. Pedro I. Moreno']),
 (9,date '1986-07-01',date '1989-06-30','Hon. Ricardo M. Bayutas','Hon. Ricardo M. Bayutas','sb','',array['Hon. Ricardo M. Bayutas']),
 (10,date '1986-07-01',date '1989-06-30','Hon. Marino P. De Garcia','Hon. Marino P. De Garcia','sb','',array['Hon. Marino P. De Garcia']),
 (11,date '1986-07-01',date '1989-06-30','Hon. Dulce Yap','Hon. Dulce Yap','sb','Service period listed: 1986-1987.',array['Hon. Dulce Yap']),
 (12,date '1989-07-01',date '1992-06-30','Hon. Apolonio M. Ygay Sr.','Hon. Apolonio M. Ygay Sr.','vice_mayor','',array['Hon. Apolonio M. Ygay Sr.']),
 (13,date '1989-07-01',date '1992-06-30','Hon. Francisco L. Bellones','Hon. Francisco L. Bellones','sb','',array['Hon. Francisco L. Bellones']),
 (14,date '1989-07-01',date '1992-06-30','Hon. Crisostomo P. Binghay','Hon. Crisostomo P. Binghay','sb','',array['Hon. Crisostomo P. Binghay']),
 (15,date '1989-07-01',date '1992-06-30','Hon. Pedro I. Moreno','Hon. Pedro I. Moreno','sb','',array['Hon. Pedro I. Moreno']),
 (16,date '1989-07-01',date '1992-06-30','Hon. Blenvenido Jabido','Hon. Blenvenido Jabido','sb','',array['Hon. Blenvenido Jabido']),
 (17,date '1989-07-01',date '1992-06-30','Hon. Marino P. De Garcia','Hon. Marino P. De Garcia','sb','',array['Hon. Marino P. De Garcia']),
 (18,date '1989-07-01',date '1992-06-30','Hon. Ricardo M. Bayutas','Hon. Ricardo M. Bayutas','sb','',array['Hon. Ricardo M. Bayutas']),
 (19,date '1989-07-01',date '1992-06-30','Hon. Onofre G. Generalao','Hon. Onofre G. Generalao','sb','',array['Hon. Onofre G. Generalao']),
 (20,date '1989-07-01',date '1992-06-30','Hon. Mario Mercado','Hon. Mario Mercado','sb','',array['Hon. Mario Mercado']),
 (21,date '1989-07-01',date '1992-06-30','Hon. Cleto Ninal','Hon. Cleto Ninal','abc','Liga ng mga Barangay / ABC President',array['Hon. Cleto Ninal']),
 (22,date '1992-07-01',date '1995-06-30','Hon. Caesar P. Dolino','Hon. Caesar P. Dolino','vice_mayor','',array['Hon. Caesar P. Dolino']),
 (23,date '1992-07-01',date '1995-06-30','Hon. Jeffrey P. Yapha','Hon. Jeffrey P. Yapha','sb','',array['Hon. Jeffrey P. Yapha']),
 (24,date '1992-07-01',date '1995-06-30','Hon. Francisco L. Bellones','Hon. Francisco L. Bellones','sb','',array['Hon. Francisco L. Bellones']),
 (25,date '1992-07-01',date '1995-06-30','Hon. Romulo B. Enario','Hon. Romulo B. Enario','sb','',array['Hon. Romulo B. Enario']),
 (26,date '1992-07-01',date '1995-06-30','Hon. Crisostomo J. Plarisan','Hon. Crisostomo J. Plarisan','sb','',array['Hon. Crisostomo J. Plarisan']),
 (27,date '1992-07-01',date '1995-06-30','Hon. Edgar C. Reyes','Hon. Edgar C. Reyes','sb','',array['Hon. Edgar C. Reyes']),
 (28,date '1992-07-01',date '1995-06-30','Hon. Valentin O. Adolfo','Hon. Valentin O. Adolfo','sb','',array['Hon. Valentin O. Adolfo']),
 (29,date '1992-07-01',date '1995-06-30','Hon. Ismael P. Soberano','Hon. Ismael P. Soberano','sb','',array['Hon. Ismael P. Soberano']),
 (30,date '1992-07-01',date '1995-06-30','Hon. Jose P. Tejano','Hon. Jose P. Tejano','sb','',array['Hon. Jose P. Tejano']),
 (31,date '1992-07-01',date '1995-06-30','Hon. Cleto P. Ninal','Hon. Cleto P. Ninal','abc','Liga ng mga Barangay / ABC President',array['Hon. Cleto P. Ninal']),
 (32,date '1995-07-01',date '1998-06-30','Hon. Jeffrey P. Yapha','Hon. Jeffrey P. Yapha','vice_mayor','',array['Hon. Jeffrey P. Yapha']),
 (33,date '1995-07-01',date '1998-06-30','Hon. Edgar C. Reyes','Hon. Edgar C. Reyes','sb','',array['Hon. Edgar C. Reyes']),
 (34,date '1995-07-01',date '1998-06-30','Hon. Ismael P. Soberano','Hon. Ismael P. Soberano','sb','',array['Hon. Ismael P. Soberano']),
 (35,date '1995-07-01',date '1998-06-30','Hon. Valentin O. Adolfo','Hon. Valentin O. Adolfo','sb','',array['Hon. Valentin O. Adolfo']),
 (36,date '1995-07-01',date '1998-06-30','Hon. Romulo B. Enario','Hon. Romulo B. Enario','sb','',array['Hon. Romulo B. Enario']),
 (37,date '1995-07-01',date '1998-06-30','Hon. Marino P. De Garcia','Hon. Marino P. De Garcia','sb','',array['Hon. Marino P. De Garcia']),
 (38,date '1995-07-01',date '1998-06-30','Hon. Precioso P. San Juan','Hon. Precioso P. San Juan','sb','',array['Hon. Precioso P. San Juan']),
 (39,date '1995-07-01',date '1998-06-30','Hon. Crisostomo J. Plarisan','Hon. Crisostomo J. Plarisan','sb','',array['Hon. Crisostomo J. Plarisan']),
 (40,date '1995-07-01',date '1998-06-30','Hon. Francisco L. Bellones','Hon. Francisco L. Bellones','sb','',array['Hon. Francisco L. Bellones']),
 (41,date '1995-07-01',date '1998-06-30','Hon. Jose L. Intong','Hon. Jose L. Intong','abc','Liga ng mga Barangay / ABC President',array['Hon. Jose L. Intong']),
 (42,date '1995-07-01',date '1998-06-30','Hon. Sharon Y. Benitez','Hon. Sharon Y. Benitez','sk','SKF President / Ex-Officio Member',array['Hon. Sharon Y. Benitez']),
 (43,date '1998-07-01',date '2001-06-30','Hon. Francisco L. Bellones','Hon. Francisco L. Bellones','vice_mayor','',array['Hon. Francisco L. Bellones']),
 (44,date '1998-07-01',date '2001-06-30','Hon. Valentin O. Adolfo','Hon. Valentin O. Adolfo','sb','',array['Hon. Valentin O. Adolfo']),
 (45,date '1998-07-01',date '2001-06-30','Hon. Ismael P. Soberano','Hon. Ismael P. Soberano','sb','',array['Hon. Ismael P. Soberano']),
 (46,date '1998-07-01',date '2001-06-30','Hon. Armando P. Ordaniza','Hon. Armando P. Ordaniza','sb','',array['Hon. Armando P. Ordaniza']),
 (47,date '1998-07-01',date '2001-06-30','Hon. Crisostomo J. Plarisan','Hon. Crisostomo J. Plarisan','sb','',array['Hon. Crisostomo J. Plarisan']),
 (48,date '1998-07-01',date '2001-06-30','Hon. Romulo B. Enario','Hon. Romulo B. Enario','sb','',array['Hon. Romulo B. Enario']),
 (49,date '1998-07-01',date '2001-06-30','Hon. Erlindo E. Dayon','Hon. Erlindo E. Dayon','sb','',array['Hon. Erlindo E. Dayon']),
 (50,date '1998-07-01',date '2001-06-30','Hon. Marino P. De Garcia','Hon. Marino P. De Garcia','sb','',array['Hon. Marino P. De Garcia']),
 (51,date '1998-07-01',date '2001-06-30','Hon. Precioso P. San Juan','Hon. Precioso P. San Juan','sb','',array['Hon. Precioso P. San Juan']),
 (52,date '1998-07-01',date '2001-06-30','Hon. Jose L. Taping','Hon. Jose L. Taping','abc','Liga ng mga Barangay / ABC President',array['Hon. Jose L. Taping']),
 (53,date '1998-07-01',date '2001-06-30','Hon. Toni Rose Y. Co','Hon. Toni Rose Y. Co','sk','SKF President / Ex-Officio Member',array['Hon. Toni Rose Y. Co']),
 (54,date '2001-07-01',date '2004-06-30','Hon. Francisco L. Bellones','Hon. Francisco L. Bellones','vice_mayor','',array['Hon. Francisco L. Bellones']),
 (55,date '2001-07-01',date '2004-06-30','Hon. Dexter Rosesdo P. Cerna','Hon. Dexter Rosesdo P. Cerna','sb','',array['Hon. Dexter Rosesdo P. Cerna']),
 (56,date '2001-07-01',date '2004-06-30','Hon. Armando P. Oradaniza','Hon. Armando P. Oradaniza','sb','',array['Hon. Armando P. Oradaniza']),
 (57,date '2001-07-01',date '2004-06-30','Hon. Erlindo E. Dayon','Hon. Erlindo E. Dayon','sb','',array['Hon. Erlindo E. Dayon']),
 (58,date '2001-07-01',date '2004-06-30','Hon. Josefa N. Lapasan','Hon. Josefa N. Lapasan','sb','',array['Hon. Josefa N. Lapasan']),
 (59,date '2001-07-01',date '2004-06-30','Hon. Jose P. Tejano','Hon. Jose P. Tejano','sb','',array['Hon. Jose P. Tejano']),
 (60,date '2001-07-01',date '2004-06-30','Hon. Jose L. Intong','Hon. Jose L. Intong','sb','',array['Hon. Jose L. Intong']),
 (61,date '2001-07-01',date '2004-06-30','Hon. Apolonio C. Ygay','Hon. Apolonio C. Ygay','sb','',array['Hon. Apolonio C. Ygay']),
 (62,date '2001-07-01',date '2004-06-30','Hon. Marino P. De Garcia','Hon. Marino P. De Garcia','sb','',array['Hon. Marino P. De Garcia']),
 (63,date '2001-07-01',date '2004-06-30','Hon. Teodulo L. Taping','Hon. Teodulo L. Taping','abc','Liga ng mga Barangay / ABC President',array['Hon. Teodulo L. Taping']),
 (64,date '2001-07-01',date '2004-06-30','Hon. Toni Rose Y. Co','Hon. Toni Rose Y. Co','sk','SKF President / Ex-Officio Member',array['Hon. Toni Rose Y. Co']),
 (65,date '2004-07-01',date '2007-06-30','Hon. Francisco L. Bellones','Hon. Francisco L. Bellones','vice_mayor','',array['Hon. Francisco L. Bellones']),
 (66,date '2004-07-01',date '2007-06-30','Hon. Maria Honeylette P. Yapha','Hon. Maria Honeylette P. Yapha','sb','',array['Hon. Maria Honeylette P. Yapha']),
 (67,date '2004-07-01',date '2007-06-30','Hon. Josefa N. Laparan','Hon. Josefa N. Laparan','sb','',array['Hon. Josefa N. Laparan']),
 (68,date '2004-07-01',date '2007-06-30','Hon. Erlindo E. Dayon','Hon. Erlindo E. Dayon','sb','',array['Hon. Erlindo E. Dayon']),
 (69,date '2004-07-01',date '2007-06-30','Hon. Armando P. Ordaniza','Hon. Armando P. Ordaniza','sb','',array['Hon. Armando P. Ordaniza']),
 (70,date '2004-07-01',date '2007-06-30','Hon. Dexter Rosesdo P. Cerna','Hon. Dexter Rosesdo P. Cerna','sb','',array['Hon. Dexter Rosesdo P. Cerna']),
 (71,date '2004-07-01',date '2007-06-30','Hon. Apolonio C. ygay Jr.','Hon. Apolonio C. ygay Jr.','sb','',array['Hon. Apolonio C. ygay Jr.']),
 (72,date '2004-07-01',date '2007-06-30','Hon. Orcid Marie A. De Garcia','Hon. Orcid Marie A. De Garcia','sb','',array['Hon. Orcid Marie A. De Garcia']),
 (73,date '2004-07-01',date '2007-06-30','Hon. Jose P. Tejano','Hon. Jose P. Tejano','sb','',array['Hon. Jose P. Tejano']),
 (74,date '2004-07-01',date '2007-06-30','Hon. Raul P. San Juan','Hon. Raul P. San Juan','abc','Liga ng mga Barangay / ABC President',array['Hon. Raul P. San Juan']),
 (75,date '2004-07-01',date '2007-06-30','Hon. Neefrey R. Cocjin','Hon. Neefrey R. Cocjin','sk','SKF President / Ex-Officio Member',array['Hon. Neefrey R. Cocjin']),
 (76,date '2007-07-01',date '2010-06-30','Hon. Jeffrey P. Yapha','Hon. Jeffrey P. Yapha','vice_mayor','',array['Hon. Jeffrey P. Yapha']),
 (77,date '2007-07-01',date '2010-06-30','Hon. Maria Honeylette P. Yapha','Hon. Maria Honeylette P. Yapha','sb','',array['Hon. Maria Honeylette P. Yapha']),
 (78,date '2007-07-01',date '2010-06-30','Hon. Josefa N. Laparan','Hon. Josefa N. Laparan','sb','',array['Hon. Josefa N. Laparan']),
 (79,date '2007-07-01',date '2010-06-30','Hon. Orcid Marie A. De Garcia','Hon. Orcid Marie A. De Garcia','sb','',array['Hon. Orcid Marie A. De Garcia']),
 (80,date '2007-07-01',date '2010-06-30','Hon. Francisco L. Bellones','Hon. Francisco L. Bellones','sb','',array['Hon. Francisco L. Bellones']),
 (81,date '2007-07-01',date '2010-06-30','Hon. Apolonio C. ygay Jr.','Hon. Apolonio C. ygay Jr.','sb','',array['Hon. Apolonio C. ygay Jr.']),
 (82,date '2007-07-01',date '2010-06-30','Hon. Dexter Rosesdo P. Cerna','Hon. Dexter Rosesdo P. Cerna','sb','',array['Hon. Dexter Rosesdo P. Cerna']),
 (83,date '2007-07-01',date '2010-06-30','Hon. Jose P. Tejano','Hon. Jose P. Tejano','sb','',array['Hon. Jose P. Tejano']),
 (84,date '2007-07-01',date '2010-06-30','Hon. Romulo B. Enario','Hon. Romulo B. Enario','sb','',array['Hon. Romulo B. Enario']),
 (85,date '2007-07-01',date '2010-06-30','Hon. Dennis B. Bareja','Hon. Dennis B. Bareja','abc','Liga ng mga Barangay / ABC President',array['Hon. Dennis B. Bareja']),
 (86,date '2007-07-01',date '2010-06-30','Hon. Jephthah P. Yapha','Hon. Jephthah P. Yapha','sk','SKF President / Ex-Officio Member',array['Hon. Jephthah P. Yapha']),
 (87,date '2010-07-01',date '2013-06-30','Hon. Maria Honeylette P. Yapha','Hon. Maria Honeylette P. Yapha','vice_mayor','',array['Hon. Maria Honeylette P. Yapha']),
 (88,date '2010-07-01',date '2013-06-30','Hon. Jeffrey Anthony P. Yapha','Hon. Jeffrey Anthony P. Yapha','sb','',array['Hon. Jeffrey Anthony P. Yapha']),
 (89,date '2010-07-01',date '2013-06-30','Hon. Oscar C. Cerna Jr.','Hon. Oscar C. Cerna Jr.','sb','',array['Hon. Oscar C. Cerna Jr.']),
 (90,date '2010-07-01',date '2013-06-30','Hon. Orcid Marie A. De Garcia','Hon. Orcid Marie A. De Garcia','sb','',array['Hon. Orcid Marie A. De Garcia']),
 (91,date '2010-07-01',date '2013-06-30','Hon. Manuelito P. Cerna','Hon. Manuelito P. Cerna','sb','',array['Hon. Manuelito P. Cerna']),
 (92,date '2010-07-01',date '2013-06-30','Hon. Bonifacio T. Alqueza','Hon. Bonifacio T. Alqueza','sb','',array['Hon. Bonifacio T. Alqueza']),
 (93,date '2010-07-01',date '2013-06-30','Hon. Marcelo T. Gerongco','Hon. Marcelo T. Gerongco','sb','',array['Hon. Marcelo T. Gerongco']),
 (94,date '2010-07-01',date '2013-06-30','Hon. Romulo B. Enario','Hon. Romulo B. Enario','sb','',array['Hon. Romulo B. Enario']),
 (95,date '2010-07-01',date '2013-06-30','Hon. Francisco L. Bellones','Hon. Francisco L. Bellones','sb','',array['Hon. Francisco L. Bellones']),
 (96,date '2010-07-01',date '2013-06-30','Hon. Dennis B. Bareja','Hon. Dennis B. Bareja','abc','Liga ng mga Barangay / ABC President',array['Hon. Dennis B. Bareja']),
 (97,date '2010-07-01',date '2013-06-30','Hon. Jephthah P. Yapha','Hon. Jephthah P. Yapha','sk','SKF President / Ex-Officio Member',array['Hon. Jephthah P. Yapha']),
 (98,date '2013-07-01',date '2016-06-30','Hon. Jeffrey Anthony P. Yapha','Hon. Jeffrey Anthony P. Yapha','sb','',array['Hon. Jeffrey Anthony P. Yapha']),
 (99,date '2013-07-01',date '2016-06-30','Hon. Oscar C. Cerna Jr.','Hon. Oscar C. Cerna Jr.','sb','',array['Hon. Oscar C. Cerna Jr.']),
 (100,date '2013-07-01',date '2016-06-30','Hon. Richard M. Canillo','Hon. Richard M. Canillo','sb','',array['Hon. Richard M. Canillo']),
 (101,date '2013-07-01',date '2016-06-30','Hon. Julius Erwin T. Alpas','Hon. Julius Erwin T. Alpas','sb','',array['Hon. Julius Erwin T. Alpas']),
 (102,date '2013-07-01',date '2016-06-30','Hon. Maria Flores D. Cantero','Hon. Maria Flores D. Cantero','sb','',array['Hon. Maria Flores D. Cantero']),
 (103,date '2013-07-01',date '2016-06-30','Hon. Benito A. Fernandez','Hon. Benito A. Fernandez','sb','',array['Hon. Benito A. Fernandez']),
 (104,date '2013-07-01',date '2016-06-30','Hon. Ernesto P. Faciol','Hon. Ernesto P. Faciol','sb','',array['Hon. Ernesto P. Faciol']),
 (105,date '2013-07-01',date '2016-06-30','Hon. Manuelito P. Cerna','Hon. Manuelito P. Cerna','sb','',array['Hon. Manuelito P. Cerna']),
 (106,date '2013-07-01',date '2016-06-30','Hon. Jeffrey P. Yapha','Hon. Jeffrey P. Yapha','abc','Liga ng mga Barangay / ABC President',array['Hon. Jeffrey P. Yapha']),
 (107,date '2013-07-01',date '2016-06-30','Hon. Mark Joseph P. Gerongco','Hon. Mark Joseph P. Gerongco','sk','SKF President / Ex-Officio Member',array['Hon. Mark Joseph P. Gerongco']),
 (108,date '2016-07-01',date '2019-06-30','Hon. Maria Honeylette Y. Lingad','Hon. Maria Honeylette Y. Lingad','vice_mayor','',array['Hon. Maria Honeylette Y. Lingad']),
 (109,date '2016-07-01',date '2019-06-30','Hon. Richard M. Canillo','Hon. Richard M. Canillo','sb','',array['Hon. Richard M. Canillo']),
 (110,date '2016-07-01',date '2019-06-30','Hon. Oscar C. Cerna Jr.','Hon. Oscar C. Cerna Jr.','sb','',array['Hon. Oscar C. Cerna Jr.']),
 (111,date '2016-07-01',date '2019-06-30','Hon. Jephthah P. Yapha','Hon. Jephthah P. Yapha','sb','',array['Hon. Jephthah P. Yapha']),
 (112,date '2016-07-01',date '2019-06-30','Hon. Julius Erwin T. Alpas','Hon. Julius Erwin T. Alpas','sb','',array['Hon. Julius Erwin T. Alpas']),
 (113,date '2016-07-01',date '2019-06-30','Hon. Manuelito P. Cerna','Hon. Manuelito P. Cerna','sb','',array['Hon. Manuelito P. Cerna']),
 (114,date '2016-07-01',date '2019-06-30','Hon. Errwin Managaytay','Hon. Errwin Managaytay','sb','',array['Hon. Errwin Managaytay']),
 (115,date '2016-07-01',date '2019-06-30','Hon. Marcelo T. Gerongco','Hon. Marcelo T. Gerongco','sb','',array['Hon. Marcelo T. Gerongco']),
 (116,date '2016-07-01',date '2019-06-30','Hon. Michael G. Sabagala','Hon. Michael G. Sabagala','sb','',array['Hon. Michael G. Sabagala']),
 (117,date '2016-07-01',date '2019-06-30','Hon. Jesus M. Managaytay','Hon. Jesus M. Managaytay','abc','Liga ng mga Barangay / ABC President',array['Hon. Jesus M. Managaytay']),
 (118,date '2019-07-01',date '2022-06-30','Hon. Richard M. Canillo','Hon. Richard M. Canillo','vice_mayor','',array['Hon. Richard M. Canillo']),
 (119,date '2019-07-01',date '2022-06-30','Hon. Ana Jessica A. Baricuatro','Hon. Ana Jessica A. Baricuatro','sb','',array['Hon. Ana Jessica A. Baricuatro']),
 (120,date '2019-07-01',date '2022-06-30','Hon. Julius Erwin T. Alpas','Hon. Julius Erwin T. Alpas','sb','',array['Hon. Julius Erwin T. Alpas']),
 (121,date '2019-07-01',date '2022-06-30','Hon. Annette J. Navarro','Hon. Annette J. Navarro','sb','',array['Hon. Annette J. Navarro']),
 (122,date '2019-07-01',date '2022-06-30','Hon. Atty. Marvin M. Miralles','Hon. Atty. Marvin M. Miralles','sb','',array['Hon. Atty. Marvin M. Miralles']),
 (123,date '2019-07-01',date '2022-06-30','Hon. Salipada C. Cerna','Hon. Salipada C. Cerna','sb','',array['Hon. Salipada C. Cerna']),
 (124,date '2019-07-01',date '2022-06-30','Hon. Marcelo t. Gerongco','Hon. Marcelo t. Gerongco','sb','',array['Hon. Marcelo t. Gerongco']),
 (125,date '2019-07-01',date '2022-06-30','Hon. Jephthah P. Yapha','Hon. Jephthah P. Yapha','sb','',array['Hon. Jephthah P. Yapha']),
 (126,date '2019-07-01',date '2022-06-30','Hon. Jeffrey Anthony P. Yapha','Hon. Jeffrey Anthony P. Yapha','sb','',array['Hon. Jeffrey Anthony P. Yapha']),
 (127,date '2019-07-01',date '2022-06-30','Hon. Jesus M. Managaytay','Hon. Jesus M. Managaytay','abc','Liga ng mga Barangay / ABC President',array['Hon. Jesus M. Managaytay']),
 (128,date '2019-07-01',date '2022-06-30','Hon. Charise M. Managaytay','Hon. Charise M. Managaytay','sk','SKF President / Ex-Officio Member',array['Hon. Charise M. Managaytay']),
 (129,date '2022-07-01',date '2025-06-30','Hon. Glenn F. Baricuatro','Hon. Glenn F. Baricuatro','vice_mayor','',array['Hon. Glenn F. Baricuatro']),
 (130,date '2022-07-01',date '2025-06-30','Hon. Richard M. Canillo','Hon. Richard M. Canillo','sb','',array['Hon. Richard M. Canillo']),
 (131,date '2022-07-01',date '2025-06-30','Hon. Annette J. Navarro','Hon. Annette J. Navarro','sb','',array['Hon. Annette J. Navarro']),
 (132,date '2022-07-01',date '2025-06-30','Hon. Atty. Marvin M. Miralles','Hon. Atty. Marvin M. Miralles','sb','',array['Hon. Atty. Marvin M. Miralles']),
 (133,date '2022-07-01',date '2025-06-30','Hon. Maria Honeylette Y. Lingad','Hon. Maria Honeylette Y. Lingad','sb','',array['Hon. Maria Honeylette Y. Lingad']),
 (134,date '2022-07-01',date '2025-06-30','Hon. Marcelo t. Gerongco','Hon. Marcelo t. Gerongco','sb','',array['Hon. Marcelo t. Gerongco']),
 (135,date '2022-07-01',date '2025-06-30','Hon. Jose A. Alqueza','Hon. Jose A. Alqueza','sb','',array['Hon. Jose A. Alqueza']),
 (136,date '2022-07-01',date '2025-06-30','Hon. Maria Elena C. Limocon','Hon. Maria Elena C. Limocon','sb','',array['Hon. Maria Elena C. Limocon']),
 (137,date '2022-07-01',date '2025-06-30','Hon. Manuelito P. Cerna','Hon. Manuelito P. Cerna','sb','',array['Hon. Manuelito P. Cerna']),
 (138,date '2022-07-01',date '2025-06-30','Hon. Jesus M. Managaytay','Hon. Jesus M. Managaytay','abc','Liga ng mga Barangay / ABC President',array['Hon. Jesus M. Managaytay']),
 (139,date '2022-07-01',date '2025-06-30','Hon. Charise M. Managaytay','Hon. Charise M. Managaytay','sk','SKF President / Ex-Officio Member',array['Hon. Charise M. Managaytay']),
 (140,date '2025-07-01',date '2028-06-30','Hon. Ana Jessica A. Baricuatro','Hon. Ana Jessica A. Baricuatro','vice_mayor','',array['Hon. Ana Jessica A. Baricuatro']),
 (141,date '2025-07-01',date '2028-06-30','Hon. Richard M. Canillo','Hon. Richard M. Canillo','sb','',array['Hon. Richard M. Canillo']),
 (142,date '2025-07-01',date '2028-06-30','Hon. Annette J. Navarro','Hon. Annette J. Navarro','sb','',array['Hon. Annette J. Navarro']),
 (143,date '2025-07-01',date '2028-06-30','Hon. Juluis Erwin T. Alpas','Hon. Julius Erwin T. Alpas','sb','',array['Hon. Juluis Erwin T. Alpas','Hon. Julius Erwin T. Alpas','Hon. Julius Erwin Alpas']),
 (144,date '2025-07-01',date '2028-06-30','Hon. Lorenzo P. Ninal','Hon. Lorenzo P. Niñal','sb','',array['Hon. Lorenzo P. Ninal','Hon. Lorenzo P. Niñal']),
 (145,date '2025-07-01',date '2028-06-30','Hon. Atty. Marvin M. Miralles','Hon. Atty. Marvin M. Miralles','sb','',array['Hon. Atty. Marvin M. Miralles']),
 (146,date '2025-07-01',date '2028-06-30','Hon. Jose A. Alqueza','Hon. Jose A. Alqueza','sb','',array['Hon. Jose A. Alqueza']),
 (147,date '2025-07-01',date '2028-06-30','Hon. Jesus M. Managaytay','Hon. Jesus M. Managaytay','sb','',array['Hon. Jesus M. Managaytay']),
 (148,date '2025-07-01',date '2028-06-30','Hon. Maria Elena C. Limocon','Hon. Maria Elena C. Limocon','sb','',array['Hon. Maria Elena C. Limocon']),
 (149,date '2025-07-01',date '2028-06-30','Hon. Joey D. Indino','Hon. Joey D. Indino','abc','Liga ng mga Barangay / ABC President',array['Hon. Joey D. Indino']),
 (150,date '2025-07-01',date '2028-06-30','Hon. Marmie Jeanne B. Albillar','Hon. Marmie Jeanne B. Albillar','sk','SKF President / Ex-Officio Member',array['Hon. Marmie Jeanne B. Albillar']),
 (151,date '1982-07-01',date '1986-06-30','Hon. Carlos B. Picson','Hon. Carlos B. Picson','vice_mayor','',array['Hon. Carlos B. Picson']),
 (152,date '1982-07-01',date '1986-06-30','Hon. Delfin Allosada','Hon. Delfin Allosada','sb','',array['Hon. Delfin Allosada']),
 (153,date '1982-07-01',date '1986-06-30','Hon. Jose R. Kyamko','Hon. Jose R. Kyamko','sb','',array['Hon. Jose R. Kyamko']),
 (154,date '1982-07-01',date '1986-06-30','Hon. Mamerto Lausa','Hon. Mamerto Lausa','sb','',array['Hon. Mamerto Lausa']),
 (155,date '1982-07-01',date '1986-06-30','Hon. Luciano Gines','Hon. Luciano Gines','sb','',array['Hon. Luciano Gines']),
 (156,date '1982-07-01',date '1986-06-30','Hon. Juanito Moñasque','Hon. Juanito Moñasque','sb','',array['Hon. Juanito Moñasque']),
 (157,date '1982-07-01',date '1986-06-30','Hon. Eusebio C. Enriques','Hon. Eusebio C. Enriques','sb','',array['Hon. Eusebio C. Enriques']),
 (158,date '1982-07-01',date '1986-06-30','Hon. Juan Malusay','Hon. Juan Malusay','sb','',array['Hon. Juan Malusay']),
 (159,date '1982-07-01',date '1986-06-30','Hon. Andres Magtagad','Hon. Andres Magtagad','sb','',array['Hon. Andres Magtagad']),
 (160,date '1982-07-01',date '1986-06-30','Hon. Chona D. Cerna','Hon. Chona D. Cerna','sb','',array['Hon. Chona D. Cerna']),
 (161,date '1982-07-01',date '1986-06-30','Hon. Maria Palapar','Hon. Maria Palapar','sb','',array['Hon. Maria Palapar']),
 (162,date '1982-07-01',date '1986-06-30','Hon. Filomena Diaz','Hon. Filomena Diaz','sb','',array['Hon. Filomena Diaz']);

create or replace function pg_temp.portal_council_name(p_name text) returns text
language sql immutable set search_path='' as $$
 select regexp_replace(translate(regexp_replace(regexp_replace(lower(trim(p_name)),
  '^hon([.][[:space:]]*|[[:space:]]+)','',''),
  '^atty([.][[:space:]]*|[[:space:]]+)','',''),'ñ','n'),'[[:space:].]+','','g');
$$;

-- Check ownership, installed guards and all existing term dates before content.
do $$
declare resolved_office uuid; matches integer; period record;
begin
 select count(*),min(id::text)::uuid into matches,resolved_office
  from public.departments where department='legislative' and active and archived_at is null;
 if matches<>1 then raise exception 'Expected one active Legislative Access office before importing the historical council'; end if;
 insert into portal_council_seed_context values(resolved_office);
 if not exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
  where t.tgrelid='public.officials'::regclass and t.tgname='z_reorder'
   and t.tgenabled='O' and p.proname='portal_reorder_content') then
  raise exception 'Unexpected officials ordering trigger state; review before importing';
 end if;
 if not exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
  where t.tgrelid='public.officials'::regclass and t.tgname='assign_legislative_term'
   and t.tgenabled='O' and p.proname='portal_term_assignment')
  or not exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
  where t.tgrelid='public.legislative_terms'::regclass and t.tgname='create_term_committees'
   and t.tgenabled='O' and p.proname='portal_create_committee_compositions') then
  raise exception 'Apply migration 036 and restore the normal term guards before importing';
 end if;
 for period in select distinct start_date,end_date from portal_council_roster order by start_date loop
  select count(*) into matches from public.legislative_terms
   where start_date=period.start_date and end_date=period.end_date;
  if matches<>1 and not (matches=0 and period.start_date=date '1982-07-01' and period.end_date=date '1986-06-30') then
   raise exception 'Expected one existing Legislative Term for % through %. Check its July 1 / June 30 dates before importing',period.start_date,period.end_date;
  end if;
 end loop;
 if not exists(select 1 from public.legislative_terms where start_date=date '1982-07-01' and end_date=date '1986-06-30')
  and exists(select 1 from public.legislative_terms
   where daterange(start_date,end_date,'[]') && daterange(date '1982-07-01',date '1986-06-30','[]')) then
  raise exception 'An existing term overlaps 1982-1986; review its dates before importing';
 end if;
end;
$$;

-- Create only the specifically authorized missing term. Normal term, date,
-- committee-generation and audit/relationship guards remain active throughout.
insert into public.legislative_terms(name,start_date,end_date)
 select '1982–1986',date '1982-07-01',date '1986-06-30'
 where not exists(select 1 from public.legislative_terms
  where start_date=date '1982-07-01' and end_date=date '1986-06-30');
update portal_council_roster r set term_id=t.id from public.legislative_terms t
 where t.start_date=r.start_date and t.end_date=r.end_date;

-- Match within the exact term. Never adopt an unassigned record, transfer an
-- existing person, change a role, or guess which duplicate identity is correct.
do $$
declare seed record; matched_id text; matches integer; current_row public.officials%rowtype; resolved_office uuid;
begin
 select office_id into strict resolved_office from portal_council_seed_context;
 for seed in select * from portal_council_roster order by start_date,sequence loop
  if seed.term_id is null then raise exception 'Unresolved term for %',seed.source_name; end if;
  if exists(select 1 from public.officials o where o.content_scope='legislative' and o.term_id is null
   and pg_temp.portal_council_name(o.name) in (select pg_temp.portal_council_name(a) from unnest(seed.name_aliases) a)) then
   raise exception 'Unassigned historical official needs review before importing: %',seed.source_name;
  end if;
  select count(*),min(o.id) into matches,matched_id from public.officials o
   where o.term_id=seed.term_id
    and pg_temp.portal_council_name(o.name) in (select pg_temp.portal_council_name(a) from unnest(seed.name_aliases) a);
  if matches>1 then raise exception 'Ambiguous existing official in %: %',seed.start_date,seed.source_name; end if;
  if matches=1 then
   select * into current_row from public.officials where id=matched_id;
   if current_row.office_id is distinct from resolved_office or current_row.content_scope<>'legislative'
    or current_row.branch<>'legislative' or current_row.legislative_role is distinct from
     (case when seed.category='vice_mayor' then 'MUNICIPAL_VICE_MAYOR' else 'SANGGUNIANG_BAYAN' end)::public.legislative_official_role then
    raise exception 'Existing official has a different role or office in %: %. Review it instead of creating a duplicate',seed.start_date,seed.source_name;
   end if;
  elsif seed.category='vice_mayor' and exists(select 1 from public.officials o
   where o.term_id=seed.term_id and o.legislative_role='MUNICIPAL_VICE_MAYOR') then
   raise exception 'A different Vice-Mayor already exists in %; review before importing %',seed.start_date,seed.source_name;
  end if;
  update portal_council_roster set official_id=coalesce(matched_id,gen_random_uuid()::text),existing=(matches=1)
   where sequence=seed.sequence;
 end loop;
 if (select count(*) from portal_council_roster)<>162
  or (select count(distinct official_id) from portal_council_roster)<>162 then
  raise exception 'Expected 162 separate term-specific official identities; no changes committed';
 end if;
end;
$$;

-- SQL Editor has no staff JWT. Suspend ONLY ordering authorization inside the
-- exclusive lock. All term, ownership, FK, audit and position guards stay on.
alter table public.officials disable trigger z_reorder;
insert into public.officials(id,name,role,branch,description,photo_url,is_sample,published,sort_order,
 office_id,content_scope,legislative_role,term_id)
select r.official_id,r.name,
 case when r.category='vice_mayor' then 'Municipal Vice-Mayor' else 'Sangguniang Bayan' end,
 'legislative',r.description,null,false,true,
 (select coalesce(max(o.sort_order),0) from public.officials o
  where o.published and o.content_scope='legislative' and o.office_id=x.office_id)
  +row_number() over(order by r.start_date,r.sequence),
 x.office_id,'legislative',
 (case when r.category='vice_mayor' then 'MUNICIPAL_VICE_MAYOR' else 'SANGGUNIANG_BAYAN' end)::public.legislative_official_role,
 r.term_id
from portal_council_roster r cross join portal_council_seed_context x where not r.existing;
set constraints all immediate;
alter table public.officials enable trigger z_reorder;

-- Verify untouched records byte-for-byte (JSON), then verify every supplied
-- person resolves to the expected term/role. Any failure rolls back everything,
-- including the missing term and its automatically generated committees.
do $$
begin
 if exists(select 1 from portal_council_officials_before b left join public.officials o on o.id=b.id
  where o.id is null or to_jsonb(o)<>b.original)
  or exists(select 1 from portal_council_terms_before b left join public.legislative_terms t on t.id=b.id
   where t.id is null or to_jsonb(t)<>b.original)
  or exists(select 1 from portal_council_committees_before b left join public.committees c on c.id=b.id
   where c.id is null or to_jsonb(c)<>b.original) then
  raise exception 'Historical council preservation check failed; no changes committed';
 end if;
 if (select count(*) from portal_council_roster r cross join portal_council_seed_context x
  join public.officials o on o.id=r.official_id and o.term_id=r.term_id
   and o.office_id=x.office_id and o.content_scope='legislative' and o.branch='legislative'
   and o.legislative_role=(case when r.category='vice_mayor' then 'MUNICIPAL_VICE_MAYOR' else 'SANGGUNIANG_BAYAN' end)::public.legislative_official_role
   and (r.existing or (o.published and o.name=r.name and o.description=r.description and o.photo_url is null and not o.is_sample)))<>162 then
  raise exception 'Historical council roster verification failed; no changes committed';
 end if;
end;
$$;

select t.name as term,t.start_date,t.end_date,count(*) as roster_entries,
 count(*) filter(where r.existing) as reused_officials,
 count(*) filter(where not r.existing) as inserted_officials,
 count(*) filter(where r.category='vice_mayor') as vice_mayors,
 count(*) filter(where r.category in ('sb','abc','sk')) as sb_members,
 count(*) filter(where r.category='abc') as abc_liga_presidents,
 count(*) filter(where r.category='sk') as sk_presidents
from portal_council_roster r join public.legislative_terms t on t.id=r.term_id
group by t.id,t.name,t.start_date,t.end_date order by t.start_date;
commit;
