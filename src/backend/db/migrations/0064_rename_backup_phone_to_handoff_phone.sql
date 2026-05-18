-- Rename backup_phone to handoff_phone.
-- This field is the dedicated number RingBooker dials when transferring a live caller to the owner.
-- Using a separate column from user_phone (login/contact) prevents loop risk and makes the intent explicit.

ALTER TABLE shops RENAME COLUMN backup_phone TO handoff_phone;
