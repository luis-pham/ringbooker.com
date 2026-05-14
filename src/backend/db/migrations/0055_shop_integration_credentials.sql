alter table shops
  add column if not exists integration_credentials_encrypted text;

comment on column shops.integration_credentials_encrypted is
  'Provider-neutral encrypted credential payload for booking/calendar integrations. Replaces using google_cal_credentials_encrypted for non-Google providers.';

update shops
set integration_credentials_encrypted = google_cal_credentials_encrypted
where integration_credentials_encrypted is null
  and google_cal_credentials_encrypted is not null
  and selected_integration = 'mindbody'
  and (
    google_cal_credentials_encrypted like '%"provider":"mindbody"%'
    or google_cal_credentials_encrypted like '%"provider": "mindbody"%'
  );
