-- Optional onboarding/service-preset hint when vertical is beauty_clinic (lash, wax, aesthetic, etc.).
ALTER TABLE shops ADD COLUMN IF NOT EXISTS vertical_detail TEXT;
