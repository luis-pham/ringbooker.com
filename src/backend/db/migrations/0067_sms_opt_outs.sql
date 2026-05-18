CREATE TABLE IF NOT EXISTS sms_opt_outs (
  phone text PRIMARY KEY,
  opted_out_at timestamptz NOT NULL DEFAULT now()
);
