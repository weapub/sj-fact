-- RLS seguras basadas en Supabase Auth (por usuario)
-- Ejecutar luego de aplicar supabase/schema.sql

-- 1) Agregar columna owner (uuid) a todas las tablas
alter table public.customers    add column if not exists owner uuid not null default auth.uid();
alter table public.products     add column if not exists owner uuid not null default auth.uid();
alter table public.priceLists   add column if not exists owner uuid not null default auth.uid();
alter table public.prices       add column if not exists owner uuid not null default auth.uid();
alter table public.invoices     add column if not exists owner uuid not null default auth.uid();
alter table public.invoiceItems add column if not exists owner uuid not null default auth.uid();
alter table public.ledger       add column if not exists owner uuid not null default auth.uid();

-- 2) Habilitar RLS (si no estaba habilitado) y limpiar políticas de prueba
alter table public.customers    enable row level security;
alter table public.products     enable row level security;
alter table public.priceLists   enable row level security;
alter table public.prices       enable row level security;
alter table public.invoices     enable row level security;
alter table public.invoiceItems enable row level security;
alter table public.ledger       enable row level security;

drop policy if exists anon_select_customers    on public.customers;
drop policy if exists anon_insert_customers    on public.customers;
drop policy if exists anon_update_customers    on public.customers;

drop policy if exists anon_select_products     on public.products;
drop policy if exists anon_insert_products     on public.products;
drop policy if exists anon_update_products     on public.products;

drop policy if exists anon_select_priceLists   on public.priceLists;
drop policy if exists anon_insert_priceLists   on public.priceLists;
drop policy if exists anon_update_priceLists   on public.priceLists;

drop policy if exists anon_select_prices       on public.prices;
drop policy if exists anon_insert_prices       on public.prices;
drop policy if exists anon_update_prices       on public.prices;

drop policy if exists anon_select_invoices     on public.invoices;
drop policy if exists anon_insert_invoices     on public.invoices;
drop policy if exists anon_update_invoices     on public.invoices;

drop policy if exists anon_select_invoiceItems on public.invoiceItems;
drop policy if exists anon_insert_invoiceItems on public.invoiceItems;
drop policy if exists anon_update_invoiceItems on public.invoiceItems;

drop policy if exists anon_select_ledger       on public.ledger;
drop policy if exists anon_insert_ledger       on public.ledger;
drop policy if exists anon_update_ledger       on public.ledger;

-- 3) Conceder privilegios al rol authenticated y revocar de anon
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

revoke all on all tables in schema public from anon;

-- 4) Políticas RLS por usuario (owner = auth.uid())

-- customers
drop policy if exists customers_select_owner on public.customers;
drop policy if exists customers_insert_owner on public.customers;
drop policy if exists customers_update_owner on public.customers;
drop policy if exists customers_delete_owner on public.customers;
create policy customers_select_owner on public.customers
  for select to authenticated using (owner = auth.uid());
create policy customers_insert_owner on public.customers
  for insert to authenticated with check (owner = auth.uid());
create policy customers_update_owner on public.customers
  for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy customers_delete_owner on public.customers
  for delete to authenticated using (owner = auth.uid());

-- products
drop policy if exists products_select_owner on public.products;
drop policy if exists products_insert_owner on public.products;
drop policy if exists products_update_owner on public.products;
drop policy if exists products_delete_owner on public.products;
create policy products_select_owner on public.products
  for select to authenticated using (owner = auth.uid());
create policy products_insert_owner on public.products
  for insert to authenticated with check (owner = auth.uid());
create policy products_update_owner on public.products
  for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy products_delete_owner on public.products
  for delete to authenticated using (owner = auth.uid());

-- priceLists
drop policy if exists priceLists_select_owner on public.priceLists;
drop policy if exists priceLists_insert_owner on public.priceLists;
drop policy if exists priceLists_update_owner on public.priceLists;
drop policy if exists priceLists_delete_owner on public.priceLists;
create policy priceLists_select_owner on public.priceLists
  for select to authenticated using (owner = auth.uid());
create policy priceLists_insert_owner on public.priceLists
  for insert to authenticated with check (owner = auth.uid());
create policy priceLists_update_owner on public.priceLists
  for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy priceLists_delete_owner on public.priceLists
  for delete to authenticated using (owner = auth.uid());

-- prices
drop policy if exists prices_select_owner on public.prices;
drop policy if exists prices_insert_owner on public.prices;
drop policy if exists prices_update_owner on public.prices;
drop policy if exists prices_delete_owner on public.prices;
create policy prices_select_owner on public.prices
  for select to authenticated using (owner = auth.uid());
create policy prices_insert_owner on public.prices
  for insert to authenticated with check (owner = auth.uid());
create policy prices_update_owner on public.prices
  for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy prices_delete_owner on public.prices
  for delete to authenticated using (owner = auth.uid());

-- invoices
drop policy if exists invoices_select_owner on public.invoices;
drop policy if exists invoices_insert_owner on public.invoices;
drop policy if exists invoices_update_owner on public.invoices;
drop policy if exists invoices_delete_owner on public.invoices;
create policy invoices_select_owner on public.invoices
  for select to authenticated using (owner = auth.uid());
create policy invoices_insert_owner on public.invoices
  for insert to authenticated with check (owner = auth.uid());
create policy invoices_update_owner on public.invoices
  for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy invoices_delete_owner on public.invoices
  for delete to authenticated using (owner = auth.uid());

-- invoiceItems
drop policy if exists invoiceItems_select_owner on public.invoiceItems;
drop policy if exists invoiceItems_insert_owner on public.invoiceItems;
drop policy if exists invoiceItems_update_owner on public.invoiceItems;
drop policy if exists invoiceItems_delete_owner on public.invoiceItems;
create policy invoiceItems_select_owner on public.invoiceItems
  for select to authenticated using (owner = auth.uid());
create policy invoiceItems_insert_owner on public.invoiceItems
  for insert to authenticated with check (owner = auth.uid());
create policy invoiceItems_update_owner on public.invoiceItems
  for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy invoiceItems_delete_owner on public.invoiceItems
  for delete to authenticated using (owner = auth.uid());

-- ledger
drop policy if exists ledger_select_owner on public.ledger;
drop policy if exists ledger_insert_owner on public.ledger;
drop policy if exists ledger_update_owner on public.ledger;
drop policy if exists ledger_delete_owner on public.ledger;
create policy ledger_select_owner on public.ledger
  for select to authenticated using (owner = auth.uid());
create policy ledger_insert_owner on public.ledger
  for insert to authenticated with check (owner = auth.uid());
create policy ledger_update_owner on public.ledger
  for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy ledger_delete_owner on public.ledger
  for delete to authenticated using (owner = auth.uid());

-- Nota: Para garantizar consistencia de owner entre tablas relacionadas,
-- se recomienda añadir triggers que copien el owner del registro padre
-- (ej: invoiceItems.owner = invoices.owner). Puede agregarse en una
-- migración posterior si lo necesitás.