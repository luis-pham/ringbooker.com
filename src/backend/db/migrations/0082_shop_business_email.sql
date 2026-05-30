alter table shops
  add column if not exists email text;

comment on column shops.email is
  'Public business contact email shown to callers and used in shop knowledge; distinct from auth user email.';
