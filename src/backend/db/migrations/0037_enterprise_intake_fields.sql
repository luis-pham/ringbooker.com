-- Enterprise / Custom intake fields captured from the public contact form.

ALTER TABLE public.contact_requests
  ADD COLUMN IF NOT EXISTS number_of_locations INTEGER,
  ADD COLUMN IF NOT EXISTS locations_text TEXT,
  ADD COLUMN IF NOT EXISTS main_contact TEXT,
  ADD COLUMN IF NOT EXISTS current_phone_provider TEXT,
  ADD COLUMN IF NOT EXISTS current_booking_software TEXT,
  ADD COLUMN IF NOT EXISTS current_crm TEXT,
  ADD COLUMN IF NOT EXISTS estimated_monthly_call_volume TEXT,
  ADD COLUMN IF NOT EXISTS languages_needed TEXT,
  ADD COLUMN IF NOT EXISTS routing_rules TEXT,
  ADD COLUMN IF NOT EXISTS escalation_rules TEXT,
  ADD COLUMN IF NOT EXISTS integration_requirements TEXT,
  ADD COLUMN IF NOT EXISTS preferred_go_live_timeline TEXT;
