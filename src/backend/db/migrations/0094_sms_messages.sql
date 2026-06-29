CREATE TABLE IF NOT EXISTS sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) ON DELETE SET NULL,
  location_id uuid REFERENCES shop_locations(id) ON DELETE SET NULL,
  telnyx_message_id text,
  telnyx_event_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number text NOT NULL,
  to_number text NOT NULL,
  body text,
  media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider text NOT NULL DEFAULT 'telnyx',
  event_type text NOT NULL,
  raw_payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sms_messages_telnyx_event_id_idx
  ON sms_messages (telnyx_event_id);

CREATE UNIQUE INDEX IF NOT EXISTS sms_messages_telnyx_message_id_idx
  ON sms_messages (telnyx_message_id)
  WHERE telnyx_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sms_messages_received_at_idx
  ON sms_messages (received_at DESC);

CREATE INDEX IF NOT EXISTS sms_messages_to_number_received_at_idx
  ON sms_messages (to_number, received_at DESC);

CREATE INDEX IF NOT EXISTS sms_messages_read_at_idx
  ON sms_messages (read_at);
