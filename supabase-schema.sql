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

create table if not exists checkout_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_description text,
  description text,
  price integer not null default 0,
  compare_at_price integer default 0,
  image text,
  gallery jsonb not null default '[]'::jsonb,
  stock integer default 0,
  sku text,
  category text,
  status text not null default 'active',
  variations jsonb not null default '[]'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  related_offers jsonb not null default '[]'::jsonb,
  advanced jsonb not null default '{}'::jsonb,
  sales_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists checkout_offers (
  id uuid primary key default gen_random_uuid(),
  internal_name text not null,
  title text not null,
  description text,
  image text,
  price integer not null default 0,
  compare_at_price integer default 0,
  status text not null default 'active',
  type text not null default 'order_bump',
  placement text not null default 'checkout',
  related_product_id uuid,
  display_condition jsonb not null default '{"type":"all"}'::jsonb,
  max_quantity integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists checkout_gateways (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  provider text not null,
  active boolean not null default false,
  environment text not null default 'production',
  public_key text,
  secret_key text,
  token text,
  webhook_url text,
  status text not null default 'disconnected',
  last_sync_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists checkout_customers (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  email text,
  cpf text,
  city text,
  state text,
  total_spent integer not null default 0,
  orders_count integer not null default 0,
  last_order_at timestamptz,
  status text not null default 'active',
  tags jsonb not null default '[]'::jsonb,
  notes text,
  traffic jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists checkout_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references checkout_orders(id) on delete set null,
  public_order_id text,
  customer_name text,
  customer_phone text,
  address jsonb not null default '{}'::jsonb,
  payment_status text,
  shipping_status text not null default 'awaiting_shipment',
  carrier text,
  tracking_code text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  history jsonb not null default '[]'::jsonb,
  sync_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists checkout_integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  name text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'disconnected',
  last_test_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists checkout_logs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  level text not null default 'info',
  source text,
  order_public_id text,
  message text not null,
  payload jsonb,
  response jsonb,
  status_code integer,
  duration_ms integer,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists checkout_admin_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  role text not null default 'admin',
  permissions jsonb not null default '{"all":true}'::jsonb,
  status text not null default 'active',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists checkout_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor text,
  action text not null,
  entity text,
  entity_id text,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

insert into checkout_settings (key, value)
values
  ('product', '{"storeName":"Barbour''s Beauty","productName":"Kit 4 Body Splash Barbours Beauty 200ml | Delight + Very Sexy + Roses + Good Grace","price":9749,"compareAtPrice":29900,"image":"IMG_2103.jpg","quantity":1,"expirationMinutes":20}'::jsonb),
  ('gateway', '{"providerName":"Elly Perfumaria","postbackUrl":"https://6a4437ee-6a2c-83e9-4571-7d0fa732u9e.vercel.app/api/freepay","pixExpiresInDays":1}'::jsonb),
  ('store', '{"storeName":"Barbour''s Beauty","domain":"","whatsapp":"","supportEmail":"","defaultCity":"","defaultState":"","status":"active","closedMessage":"Loja temporariamente fechada.","currency":"BRL","timezone":"America/Sao_Paulo"}'::jsonb),
  ('checkout', '{"timerMinutes":20,"pixDiscount":0,"buttonText":"Pagar","securityText":"Seus dados estão seguros conosco","quickBuy":true,"skipCart":true,"couponEnabled":false,"phoneRequired":true,"cpfRequired":true,"addressRequired":true,"emailAutocomplete":true,"masksEnabled":true,"creditCardEnabled":true,"creditCardMaxInstallments":12,"creditCardInstallmentFee":3.99}'::jsonb),
  ('branding', '{"logo":"","favicon":"","primaryColor":"#FE2C56","secondaryColor":"#101828","buttonColor":"#FE2C56","backgroundColor":"#f5f7fb","textColor":"#101828","fontPrimary":"Inter","fontHeadings":"Inter","backgroundImage":"","mainBanner":""}'::jsonb),
  ('gateway_names', '{"enabled":false,"names":[],"dedupe":true}'::jsonb),
  ('gateway_masking', '{"providerName":"Elly Perfumaria","sendUtmsToGateway":false,"maskExternalOrderId":true,"maskItemRefs":true,"defaultUtm":""}'::jsonb),
  ('appearance', '{"badges":[],"reviews":[],"faq":[],"footerText":""}'::jsonb),
  ('integrations', '{"utmifyToken":"","utmifyEnabled":false,"sendPending":true,"sendPaid":true,"sendCanceled":false,"externalScripts":"","extraWebhook":""}'::jsonb),
  ('system', '{"maintenance":false,"backupEnabled":false,"securityLevel":"standard"}'::jsonb),
  ('offers', '[{"id":"my-sweet-delight","name":"Essential Body Cream - My Sweet Delight 230g","price":1990,"compareAtPrice":3990,"image":"IMG_2112.PNG.png","enabled":true},{"id":"very-sexy","name":"Essential Body Cream - Very Sexy 230g","price":1990,"compareAtPrice":3990,"image":"IMG_2112.PNG.png","enabled":true},{"id":"roses","name":"Essential Body Cream - Roses 230g","price":1990,"compareAtPrice":3990,"image":"IMG_2112.PNG.png","enabled":true},{"id":"good-graces","name":"Essential Body Cream - Good Graces 230g","price":1990,"compareAtPrice":3990,"image":"IMG_2112.PNG.png","enabled":true}]'::jsonb)
on conflict (key) do nothing;
