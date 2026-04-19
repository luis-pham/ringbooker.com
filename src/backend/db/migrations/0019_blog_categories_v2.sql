-- Standard blog categories (CMS checkboxes). Idempotent: upsert by unique slug.
INSERT INTO "Category" ("id", "name", "slug")
VALUES
  (gen_random_uuid()::text, 'AI Receptionists', 'ai-receptionists'),
  (gen_random_uuid()::text, 'Missed Calls', 'missed-calls'),
  (gen_random_uuid()::text, 'After-Hours Calls', 'after-hours-calls'),
  (gen_random_uuid()::text, 'Booking Tips', 'booking-tips'),
  (gen_random_uuid()::text, 'Salon Operations', 'salon-operations'),
  (gen_random_uuid()::text, 'Revenue Growth', 'revenue-growth'),
  (gen_random_uuid()::text, 'Case Studies', 'case-studies')
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name";
