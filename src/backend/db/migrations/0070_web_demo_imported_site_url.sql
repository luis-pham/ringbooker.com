-- Track whether a web demo session was started with a website URL import.
-- NULL means the user did not import a website (used sample/manual data).
alter table web_demo_sessions
  add column if not exists imported_site_url text;
