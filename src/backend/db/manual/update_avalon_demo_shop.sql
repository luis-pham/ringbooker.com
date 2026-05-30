-- One-time demo data patch for the existing Avalon test shop.
-- Run manually in Supabase SQL Editor. Do not run as an automatic migration.
--
-- Safety:
-- - Updates one existing shop only.
-- - Does not change shop id, owner/user phones, handoff phone, Telnyx number,
--   plan/billing fields, selected integration, booking method, or credentials.
-- - Public demo phone remains in AI knowledge because phone_number is runtime/Telnyx-facing.

begin;

alter table shops
  add column if not exists email text;

create temp table _avalon_demo_target_shop on commit drop as
select id
from shops
where id = '7b443d4d-5772-4ba1-96f7-b4bd0ee2f575'::uuid
   or name in ('Avalon Salon and Spa', 'Luxe Hair Studio')
order by case
  when id = '7b443d4d-5772-4ba1-96f7-b4bd0ee2f575'::uuid then 0
  when name = 'Avalon Salon and Spa' then 1
  else 2
end
limit 1;

do $$
begin
  if (select count(*) from _avalon_demo_target_shop) <> 1 then
    raise exception 'Avalon demo shop not found or target is ambiguous';
  end if;
end $$;

update shops
set
  name = 'Luxe Hair Studio',
  vertical = 'hair_salon',
  vertical_detail = 'full-service hair salon',
  address = '2847 South Lamar Blvd, Austin, TX 78704',
  email = 'hello@luxehairstudio.com',
  timezone = 'America/Chicago',
  website_url = 'https://luxehairstudio.com',
  country_code = 'US',
  booking_url = coalesce(nullif(booking_url, ''), 'https://luxehairstudio.com/book'),
  ai_welcome_message = 'Thank you for calling Luxe Hair Studio. How can I help you today?',
  ai_custom_instructions = $$Business: Luxe Hair Studio, a full-service hair salon in Austin, TX.
Address: 2847 South Lamar Blvd, Austin TX 78704. Public phone: (512) 555-0183. Email: hello@luxehairstudio.com. Website: luxehairstudio.com.
Parking: Free street parking on S Lamar plus a small lot behind the building. Landmark: next to Epoch Coffee on S Lamar, across from Alamo Drafthouse.
Hours: Monday closed. Tuesday-Wednesday 9:00 AM-7:00 PM. Thursday-Friday 9:00 AM-8:00 PM. Saturday 8:00 AM-6:00 PM. Sunday 10:00 AM-4:00 PM. Lunch break is 1:00-2:00 PM daily. Last appointment starts 60 minutes before close.
Staff: Jessica Lee, owner and master stylist, color specialist, 12 years experience. Marcus Rivera, senior stylist for cuts and color, 7 years experience. Ashley Thompson, stylist for cuts and blowouts, 4 years experience. Kayla Nguyen, junior stylist for blowouts and styling, 2 years experience.
Services: women's haircut and style $75/60 min; men's haircut $45/30 min; kids haircut under 12 $35/30 min; bang trim $20/15 min; full highlights $185/150 min; partial highlights $135/105 min; single process color $95/90 min; balayage or ombre $220/180 min; color correction from $300/240 min; toner or gloss $65/45 min; blowout $55/45 min; blowout plus style $70/60 min; deep conditioning treatment $45/30 min; keratin treatment $250/150 min; bridal updo $150/90 min.
Booking policies: 25% deposit required for color services over $150. 24 hours cancellation notice required. Late cancellation fee is 50% of service price. No-show fee is 100% of service price. New client intake form required. Max advance booking is 90 days. Min advance booking is 2 hours. Walk-ins welcome for cuts only, subject to availability. Free 15 min color consultation for new color clients.$$,
  hours = '{
    "mon": {"closed": true},
    "tue": {"open": "09:00", "close": "19:00"},
    "wed": {"open": "09:00", "close": "19:00"},
    "thu": {"open": "09:00", "close": "20:00"},
    "fri": {"open": "09:00", "close": "20:00"},
    "sat": {"open": "08:00", "close": "18:00"},
    "sun": {"open": "10:00", "close": "16:00"}
  }'::jsonb,
  services = '[
    {"name": "Women''s haircut & style", "duration_min": 60, "price": 75},
    {"name": "Men''s haircut", "duration_min": 30, "price": 45},
    {"name": "Kids haircut (under 12)", "duration_min": 30, "price": 35},
    {"name": "Bang trim", "duration_min": 15, "price": 20},
    {"name": "Full highlights", "duration_min": 150, "price": 185},
    {"name": "Partial highlights", "duration_min": 105, "price": 135},
    {"name": "Single process color", "duration_min": 90, "price": 95},
    {"name": "Balayage / ombre", "duration_min": 180, "price": 220},
    {"name": "Color correction", "duration_min": 240, "price": 300},
    {"name": "Toner / gloss", "duration_min": 45, "price": 65},
    {"name": "Blowout", "duration_min": 45, "price": 55},
    {"name": "Blowout + style", "duration_min": 60, "price": 70},
    {"name": "Deep conditioning treatment", "duration_min": 30, "price": 45},
    {"name": "Keratin treatment", "duration_min": 150, "price": 250},
    {"name": "Bridal updo", "duration_min": 90, "price": 150}
  ]'::jsonb,
  staff = '[
    {"name": "Jessica Lee", "role": "Owner / Master Stylist", "specialties": ["Color specialist"], "notes": "12 years experience", "active": true},
    {"name": "Marcus Rivera", "role": "Senior Stylist", "specialties": ["Cuts", "Color"], "notes": "7 years experience", "active": true},
    {"name": "Ashley Thompson", "role": "Stylist", "specialties": ["Cuts", "Blowouts"], "notes": "4 years experience", "active": true},
    {"name": "Kayla Nguyen", "role": "Junior Stylist", "specialties": ["Blowouts", "Styling"], "notes": "2 years experience", "active": true}
  ]'::jsonb,
  faqs = '[
    {"question": "Where should clients park?", "answer": "There is free street parking on S Lamar and a small lot behind the building."},
    {"question": "What landmark is nearby?", "answer": "Luxe Hair Studio is next to Epoch Coffee on S Lamar and across from Alamo Drafthouse."},
    {"question": "Do you accept walk-ins?", "answer": "Walk-ins are welcome for cuts only and are subject to availability."},
    {"question": "Do new color clients need a consultation?", "answer": "New color clients can book a free 15 minute color consultation."}
  ]'::jsonb,
  cancel_policy = '24 hours notice required. Late cancellations are charged 50% of the service price. No-shows are charged 100% of the service price. Color services over $150 require a 25% deposit. New client intake form required. Max advance booking is 90 days; min advance booking is 2 hours.',
  promotions = null,
  updated_at = now()
where id = (select id from _avalon_demo_target_shop);

update shop_locations
set
  name = 'Luxe Hair Studio',
  address = '2847 South Lamar Blvd, Austin, TX 78704',
  timezone = 'America/Chicago',
  business_hours = '{
    "mon": {"closed": true},
    "tue": {"open": "09:00", "close": "19:00"},
    "wed": {"open": "09:00", "close": "19:00"},
    "thu": {"open": "09:00", "close": "20:00"},
    "fri": {"open": "09:00", "close": "20:00"},
    "sat": {"open": "08:00", "close": "18:00"},
    "sun": {"open": "10:00", "close": "16:00"}
  }'::jsonb,
  updated_at = now()
where shop_id = (select id from _avalon_demo_target_shop)
  and active = true;

delete from shop_services
where shop_id = (select id from _avalon_demo_target_shop);

delete from shop_service_categories
where shop_id = (select id from _avalon_demo_target_shop);

with target_shop as (
  select id as shop_id from _avalon_demo_target_shop
),
inserted_categories as (
  insert into shop_service_categories (shop_id, name, description, sort_order, active, updated_at)
  select shop_id, category_name, null, sort_order, true, now()
  from target_shop
  cross join (
    values
      ('Cuts', 0),
      ('Color', 1),
      ('Styling & Treatments', 2)
  ) as category(category_name, sort_order)
  returning id, shop_id, name
),
service_input(category_name, service_name, duration_minutes, price_amount, price_type, sort_order, booking_notes) as (
  values
    ('Cuts', 'Women''s haircut & style', 60, 75, 'fixed', 0, null),
    ('Cuts', 'Men''s haircut', 30, 45, 'fixed', 1, null),
    ('Cuts', 'Kids haircut (under 12)', 30, 35, 'fixed', 2, null),
    ('Cuts', 'Bang trim', 15, 20, 'fixed', 3, null),
    ('Color', 'Full highlights', 150, 185, 'fixed', 0, '25% deposit required because this color service is over $150.'),
    ('Color', 'Partial highlights', 105, 135, 'fixed', 1, null),
    ('Color', 'Single process color', 90, 95, 'fixed', 2, null),
    ('Color', 'Balayage / ombre', 180, 220, 'fixed', 3, '25% deposit required because this color service is over $150.'),
    ('Color', 'Color correction', 240, 300, 'from', 4, 'Price starts at $300. 25% deposit required.'),
    ('Color', 'Toner / gloss', 45, 65, 'fixed', 5, null),
    ('Color', 'Color consultation', 15, 0, 'consultation', 6, 'Free for new color clients.'),
    ('Styling & Treatments', 'Blowout', 45, 55, 'fixed', 0, null),
    ('Styling & Treatments', 'Blowout + style', 60, 70, 'fixed', 1, null),
    ('Styling & Treatments', 'Deep conditioning treatment', 30, 45, 'fixed', 2, null),
    ('Styling & Treatments', 'Keratin treatment', 150, 250, 'fixed', 3, null),
    ('Styling & Treatments', 'Bridal updo', 90, 150, 'fixed', 4, null)
)
insert into shop_services (
  shop_id,
  category_id,
  name,
  duration_text,
  duration_minutes,
  price_amount,
  price_currency,
  price_type,
  bookable,
  active,
  sort_order,
  aliases,
  booking_notes,
  external_metadata,
  updated_at
)
select
  category.shop_id,
  category.id,
  service.service_name,
  service.duration_minutes::text || ' min',
  service.duration_minutes,
  service.price_amount,
  'USD',
  service.price_type,
  true,
  true,
  service.sort_order,
  '[]'::jsonb,
  service.booking_notes,
  '{}'::jsonb,
  now()
from service_input service
join inserted_categories category
  on category.name = service.category_name;

select
  s.id,
  s.name,
  s.timezone,
  s.address,
  s.email,
  s.website_url,
  s.booking_method,
  s.selected_integration,
  s.phone_number as preserved_runtime_phone,
  s.user_phone as preserved_owner_phone,
  s.telnyx_number as preserved_telnyx_number,
  s.plan as preserved_plan,
  jsonb_array_length(s.services) as legacy_service_count,
  (select count(*) from shop_services ss where ss.shop_id = s.id) as service_catalog_count
from shops s
where s.id = (select id from _avalon_demo_target_shop);

commit;
