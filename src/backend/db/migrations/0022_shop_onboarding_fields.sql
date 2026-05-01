ALTER TABLE shops
ADD COLUMN IF NOT EXISTS vertical TEXT;
-- values: nail_salon | hair_salon | day_spa | med_spa | beauty_clinic

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS languages TEXT[]
DEFAULT ARRAY['en'];
-- values: 'en', 'vi', 'es'

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS website_url TEXT;

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS current_onboarding_step INTEGER DEFAULT 1;
-- tracks resume position (1-4)
