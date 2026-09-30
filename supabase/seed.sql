-- OPTIONAL SAMPLE CONTENT. All seeded records are fictional and marked is_sample=true.
-- Existing records are never overwritten; drafts/edits stay as they are on rerun.
begin;

insert into public.officials (id, name, role, branch, description, photo_url, is_sample, published, sort_order) values
  ('mayor', 'Municipal Mayor', 'Office of the Municipal Mayor', 'executive', 'Leading the delivery of public services and the implementation of municipal programs.', NULL, true, true, 0),
  ('administrator', 'Municipal Administrator', 'Office of the Administrator', 'executive', 'Coordinating municipal operations and supporting responsive public administration.', NULL, true, true, 1),
  ('planning', 'Planning & Development', 'Municipal Planning Office', 'executive', 'Planning sustainable development for our communities.', NULL, true, true, 2),
  ('public-service', 'Municipal Departments', 'At your service', 'executive', 'Connecting residents with the right offices and services.', NULL, true, true, 3),
  ('vice-mayor', 'Municipal Vice Mayor', 'Presiding Officer', 'legislative', 'Presiding over the Sangguniang Bayan and supporting local legislation.', NULL, true, true, 4),
  ('members', 'Sangguniang Bayan', 'Municipal Council Members', 'legislative', 'Representing the community through responsive local legislation.', NULL, true, true, 5),
  ('committees', 'Standing Committees', 'Legislative Committees', 'legislative', 'Reviewing proposals through focused study and consultation.', NULL, true, true, 6),
  ('secretariat', 'SB Secretariat', 'Office of the Secretary', 'legislative', 'Maintaining legislative records and supporting council proceedings.', NULL, true, true, 7)
on conflict (id) do nothing;

insert into public.ordinances (id, number, title, date_approved, year, author, co_author, status, summary, pdf_url, is_sample, published, sort_order) values
  ('water-safety', '01-2026', 'Establishing community water safety standards', '2026-01-20', 2026, 'Sample Council Member A', NULL, 'Approved', 'A sample ordinance outlining water quality monitoring, reporting, and community awareness measures.', '/documents/sample-legislative-document.pdf', true, true, 0),
  ('solid-waste', '02-2026', 'Strengthening barangay solid waste management', '2026-03-16', 2026, 'Sample Council Member B', NULL, 'Approved', 'A sample policy promoting waste segregation, collection coordination, and environmental education.', '/documents/sample-legislative-document.pdf', true, true, 1),
  ('local-enterprise', '03-2026', 'Supporting local micro and small enterprises', '2026-06-08', 2026, 'Sample Council Member C', NULL, 'Approved', 'A sample framework for business assistance and skills development for local entrepreneurs.', '/documents/sample-legislative-document.pdf', true, true, 2),
  ('coastal-protection', '12-2025', 'Promoting coastal protection and responsible tourism', '2025-11-17', 2025, 'Sample Council Member A', NULL, 'Approved', 'A sample measure for community participation in coastal conservation.', '/documents/sample-legislative-document.pdf', true, true, 3)
on conflict (id) do nothing;

insert into public.resolutions (id, number, title, date_approved, year, author, co_author, status, summary, pdf_url, is_sample, published, sort_order) values
  ('health-outreach', '42-2026', 'Supporting a community health outreach program', '2026-09-21', 2026, 'Sample Council Member A', 'Sample Council Member B', 'Adopted', 'A sample resolution supporting coordination of community health information and outreach activities.', '/documents/sample-legislative-document.pdf', true, true, 0),
  ('youth-development', '38-2026', 'Endorsing municipal youth development activities', '2026-08-10', 2026, 'Sample Council Member C', 'Sample Council Member A', 'Adopted', 'A sample resolution encouraging youth participation and leadership development.', '/documents/sample-legislative-document.pdf', true, true, 1),
  ('agriculture-support', '27-2025', 'Recognizing the contribution of local farmers', '2025-10-06', 2025, 'Sample Council Member B', 'Sample Council Member C', 'Adopted', 'A sample resolution recognizing local agriculture and food security efforts.', '/documents/sample-legislative-document.pdf', true, true, 2)
on conflict (id) do nothing;

insert into public.news (slug, title, category, date, excerpt, image, content, is_sample, published, sort_order) values
  ('community-first', 'Bringing municipal services closer to every barangay', 'Executive', '2026-09-28', 'A community-centered approach to making public services more accessible.', '/images/news/community.svg', ARRAY['This sample update demonstrates how executive news will appear on the municipal portal. It is not an announcement of a confirmed activity.', 'The proposed feature brings service information together in one place, helping residents find the appropriate municipal office, understand requirements, and prepare for their visit.', 'Verified schedules, participating offices, and contact details can be added by the municipality before publication.']::text[], true, true, 0),
  ('regular-session', 'In focus: the work of the Sangguniang Bayan', 'Legislative', '2026-09-28', 'Follow council sessions, proposed measures, and matters that shape our community.', '/images/news/council.svg', ARRAY['This is a sample legislative news article for demonstration purposes.', 'The legislative portal provides a place for session summaries, agendas, ordinances, and resolutions. Residents can browse records and learn more about the work of municipal committees.', 'Official minutes, photographs, and approved documents will be supplied by the Sangguniang Bayan Secretariat.']::text[], true, true, 1),
  ('coastal-community', 'Working together for a cleaner, greener coastline', 'Environment', '2026-09-24', 'Shared responsibility for the natural places that make our municipality home.', '/images/news/coast.svg', ARRAY['This sample environmental story is illustrative and does not describe a confirmed event.', 'Community participation can support coastal protection through responsible waste management and environmental education.', 'Verified project details and photos will be added when municipal content becomes available.']::text[], true, true, 2),
  ('health-information', 'A guide to community health services', 'Health', '2026-09-22', 'Find the right office for primary care information and community health assistance.', '/images/news/community.svg', ARRAY['This sample guide introduces the health service directory.', 'Contact the Municipal Health Office to confirm available services, schedules, and requirements before visiting. No medical appointments can be booked through this preview.']::text[], true, true, 3),
  ('public-service-advisory', 'Plan your visit to the municipal hall', 'Announcements', '2026-09-20', 'Use our service directory to find the office that can help with your concern.', '/images/news/council.svg', ARRAY['This sample advisory helps demonstrate the announcement layout.', 'Use the municipal service directory for general information. Office hours, documentary requirements, fees, and processing times must be confirmed with the responsible office.']::text[], true, true, 4)
on conflict (slug) do nothing;

insert into public.sessions (id, number, type, date, description, agenda, image, is_sample, published, sort_order) values
  ('61st-regular', '61st', 'Regular session', '2026-09-28', 'Sample session of the 17th Sangguniang Bayan, covering committee reports and community matters.', ARRAY['Call to order and roll call', 'Approval of previous minutes', 'Committee reports', 'Discussion of proposed measures', 'Other matters and adjournment']::text[], '/images/news/council.svg', true, true, 0),
  ('60th-regular', '60th', 'Regular session', '2026-09-21', 'Sample deliberations on public services and local development priorities.', ARRAY['Review of communications', 'Public service committee report', 'Local development proposals']::text[], '/images/news/council.svg', true, true, 1),
  ('3rd-special', '3rd', 'Special session', '2026-09-17', 'Sample special session for time-sensitive municipal matters.', ARRAY['Call to order', 'Consideration of special agenda', 'Adjournment']::text[], '/images/news/council.svg', true, true, 2),
  ('committee-caucus', 'September', 'Caucus meeting', '2026-09-14', 'Sample preparatory discussion of committee priorities.', ARRAY['Committee coordination', 'Scheduling of consultations']::text[], '/images/news/council.svg', true, true, 3)
on conflict (id) do nothing;

insert into public.services (id, name, description, icon, office, steps, is_sample, published, sort_order) values
  ('business-permits', 'Business Permits', 'Information on starting, renewing, and registering your local business.', 'briefcase', 'Business Permits and Licensing Office', ARRAY['Ask the licensing office for the current application checklist.', 'Prepare the required business and identity documents.', 'Submit your application and confirm the assessment and release schedule.']::text[], true, true, 0),
  ('civil-registry', 'Civil Registry', 'Assistance with birth, marriage, death, and other civil registry records.', 'file', 'Municipal Civil Registrar', ARRAY['Identify the record or registration service you need.', 'Confirm identity and authorization requirements with the registrar.', 'Submit your request at the Civil Registry office.']::text[], true, true, 1),
  ('health', 'Health Services', 'Connect with primary care and community health programs.', 'heart', 'Municipal Health Office', ARRAY['Contact the health office for current service availability.', 'Ask about clinic schedules and any required records.', 'Visit the appropriate health facility.']::text[], true, true, 2),
  ('social-welfare', 'Social Welfare', 'Support and assistance for individuals and families in need.', 'users', 'Municipal Social Welfare and Development Office', ARRAY['Discuss your concern with the social welfare office.', 'Confirm eligibility and documentation for the relevant assistance.', 'Follow the assessment and referral process.']::text[], true, true, 3),
  ('assessor', 'Assessor’s Office', 'Information on property assessment and tax declarations.', 'building', 'Municipal Assessor', ARRAY['Identify your property assessment concern.', 'Confirm the relevant property documents.', 'Submit the request to the assessor.']::text[], true, true, 4),
  ('treasurer', 'Treasurer’s Office', 'Inquiries about local taxes, fees, and official payments.', 'wallet', 'Municipal Treasurer', ARRAY['Confirm the applicable assessment and payment requirements.', 'Pay only through authorized municipal channels.', 'Keep your official receipt.']::text[], true, true, 5),
  ('engineering', 'Engineering', 'Guidance on building permits and municipal infrastructure concerns.', 'building', 'Municipal Engineering Office', ARRAY['Describe your construction or infrastructure inquiry.', 'Request the current technical requirements.', 'Submit plans and documentation to the responsible office.']::text[], true, true, 6),
  ('agriculture', 'Agriculture', 'Information and support for farmers and local agriculture.', 'sprout', 'Municipal Agriculture Office', ARRAY['Contact the agriculture office about available support.', 'Confirm registration or eligibility requirements.', 'Coordinate the next steps with the assigned staff.']::text[], true, true, 7),
  ('disaster-risk', 'Disaster Risk Reduction', 'Preparedness information and disaster risk reduction programs.', 'shield', 'Municipal Disaster Risk Reduction and Management Office', ARRAY['Ask the office for verified local preparedness information.', 'Know your barangay evacuation routes and contacts.', 'Follow official advisories during emergencies.']::text[], true, true, 8)
on conflict (id) do nothing;

insert into public.departments (id, name, description, is_sample, published, sort_order) values
  ('administration', 'Municipal Administration', 'Coordination of day-to-day operations and municipal public service delivery.', true, true, 0),
  ('planning', 'Planning & Development Office', 'Municipal development planning, monitoring, and coordination.', true, true, 1),
  ('budget', 'Municipal Budget Office', 'Preparation and administration of the municipal budget.', true, true, 2),
  ('health', 'Municipal Health Office', 'Primary health care information and community health programs.', true, true, 3),
  ('engineering', 'Municipal Engineering Office', 'Infrastructure planning and technical public services.', true, true, 4),
  ('social-welfare', 'Social Welfare & Development', 'Community support and assistance for vulnerable residents.', true, true, 5)
on conflict (id) do nothing;

insert into public.programs (id, name, description, category, status, is_sample, published, sort_order) values
  ('community-services', 'Services within reach', 'A proposed community outreach initiative connecting residents with municipal services.', 'Public service', 'Sample program', true, true, 0),
  ('green-communities', 'Greener communities', 'An illustrative program supporting waste management, coastal care, and environmental awareness.', 'Environment', 'Sample program', true, true, 1),
  ('local-livelihoods', 'Growing local livelihoods', 'An illustrative initiative for skills development and local enterprise support.', 'Livelihood', 'Sample program', true, true, 2)
on conflict (id) do nothing;

insert into public.committees (id, name, responsibility, chair, is_sample, published, sort_order) values
  ('finance', 'Finance & Appropriations', 'Reviews proposed budgets, appropriations, and financial measures.', 'Chairperson to be confirmed', true, true, 0),
  ('health', 'Health & Social Services', 'Considers measures supporting public health and community welfare.', 'Chairperson to be confirmed', true, true, 1),
  ('environment', 'Environment & Natural Resources', 'Reviews environmental protection and resource management proposals.', 'Chairperson to be confirmed', true, true, 2),
  ('education', 'Education, Culture & Youth', 'Considers initiatives for education, culture, and youth participation.', 'Chairperson to be confirmed', true, true, 3)
on conflict (id) do nothing;

insert into public.hearings (id, title, date, venue, sectors, related_ordinance, status, is_sample, published, sort_order) values
  ('waste-consultation', 'Community consultation on waste management', '2026-10-12', 'Sample venue: SB Session Hall', 'Barangay representatives, residents, local businesses', 'Sample proposed waste management amendment', 'Upcoming', true, true, 0),
  ('coastal-consultation', 'Coastal protection and responsible tourism', '2026-09-10', 'Sample venue: Municipal Hall', 'Fisherfolk, tourism stakeholders, community groups', 'Sample Ordinance No. 12-2025', 'Previous', true, true, 1)
on conflict (id) do nothing;

insert into public.document_categories (id, name, description, href, is_sample, published, sort_order) values
  ('full-disclosure', 'Full Disclosure', 'Financial reports and disclosures for public accountability.', NULL, true, true, 0),
  ('ordinances', 'Ordinances', 'Browse sample local legislative measures.', '/legislative/ordinances', true, true, 1),
  ('resolutions', 'Resolutions', 'Browse sample resolutions of the Sangguniang Bayan.', '/legislative/resolutions', true, true, 2),
  ('municipal-documents', 'Municipal documents', 'Municipal plans, reports, and other public information.', NULL, true, true, 3),
  ('budget', 'Budget documents', 'Annual budgets and financial planning documents.', NULL, true, true, 4),
  ('procurement', 'Procurement documents', 'Procurement plans, invitations, and award notices.', NULL, true, true, 5),
  ('public-notices', 'Public notices', 'Public advisories and notices issued by the municipality.', NULL, true, true, 6)
on conflict (id) do nothing;

commit;
