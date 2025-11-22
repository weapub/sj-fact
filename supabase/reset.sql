-- Reset completo del esquema: elimina tablas e índices para arrancar de cero
-- Ejecutar en el editor SQL de tu proyecto Supabase.

-- El orden de drop respeta dependencias (detalles primero, tablas base después)
begin;

-- Índices (se eliminan explícitamente por claridad; el drop de tabla también los remueve)
drop index if exists idx_ledger_customer_date;
drop index if exists idx_prices_list_product;
drop index if exists idx_invoiceitems_invoice;
drop index if exists idx_invoices_customer_date;

-- Tablas dependientes
drop table if exists public.invoiceItems cascade;
drop table if exists public.invoices cascade;
drop table if exists public.ledger cascade;
drop table if exists public.prices cascade;

-- Tablas base
drop table if exists public.priceLists cascade;
drop table if exists public.products cascade;
drop table if exists public.customers cascade;

commit;

-- Tras ejecutar este script, corre supabase/schema.sql y luego supabase/rls.sql
-- y refresca el esquema en Project Settings → API → Refresh Schema.