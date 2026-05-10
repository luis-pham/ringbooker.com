alter table shops
  add column if not exists not_offered_services text[] not null default '{}';
