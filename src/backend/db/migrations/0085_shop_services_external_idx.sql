create unique index if not exists shop_services_external_uniq_idx
  on public.shop_services(shop_id, external_provider, external_service_id)
  where external_provider is not null
    and external_service_id is not null;
