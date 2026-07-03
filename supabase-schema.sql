create table if not exists checkout_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists checkout_orders (
  id uuid primary key default gen_random_uuid(),
  public_id text unique not null,
  external_order_id text unique not null,
  provider text not null default 'Elly Perfumaria',
  status text not null default 'CREATED',
  amount integer not null,
  subtotal integer not null,
  shipping_fee integer not null default 0,
  payment_method text not null default 'pix',
  freepay_transaction_id text,
  pix_code text,
  pix_url text,
  pix_expires_at timestamptz,
  customer jsonb not null,
  shipping_address jsonb,
  items jsonb not null,
  utms jsonb,
  raw_gateway_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists checkout_pixels (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('meta', 'tiktok')),
  name text not null,
  pixel_id text not null,
  access_token text,
  enabled boolean not null default true,
  events jsonb not null default '{"page_view":true,"initiate_checkout":true,"purchase":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into checkout_settings (key, value)
values
  ('product', '{"storeName":"Barbour''s Beauty","productName":"Kit 4 Body Splash Barbours Beauty 200ml | Delight + Very Sexy + Roses + Good Grace","price":9749,"compareAtPrice":29900,"image":"IMG_2103.jpg","quantity":1,"expirationMinutes":20}'::jsonb),
  ('gateway', '{"providerName":"Elly Perfumaria","postbackUrl":"https://6a4437ee-6a2c-83e9-4571-7d0fa732u9e.vercel.app/api/freepay","pixExpiresInDays":1}'::jsonb),
  ('offers', '[{"id":"my-sweet-delight","name":"Essential Body Cream - My Sweet Delight 230g","price":1990,"compareAtPrice":3990,"image":"IMG_2112.PNG.png","enabled":true},{"id":"very-sexy","name":"Essential Body Cream - Very Sexy 230g","price":1990,"compareAtPrice":3990,"image":"IMG_2112.PNG.png","enabled":true},{"id":"roses","name":"Essential Body Cream - Roses 230g","price":1990,"compareAtPrice":3990,"image":"IMG_2112.PNG.png","enabled":true},{"id":"good-graces","name":"Essential Body Cream - Good Graces 230g","price":1990,"compareAtPrice":3990,"image":"IMG_2112.PNG.png","enabled":true}]'::jsonb)
on conflict (key) do nothing;
