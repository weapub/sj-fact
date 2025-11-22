-- Ajuste de secuencias (identity/serial) para evitar errores de PK duplicado
-- Úsalo cuando previamente insertaste filas con IDs explícitos y luego
-- empezaste a insertar sin 'id' (por defecto de la secuencia).

begin;

-- Para cada tabla, ponemos la secuencia en max(id)+1
select setval(pg_get_serial_sequence('public.customers',    'id'), coalesce((select max(id) from public.customers),    1));
select setval(pg_get_serial_sequence('public.products',     'id'), coalesce((select max(id) from public.products),     1));
select setval(pg_get_serial_sequence('public.priceLists',   'id'), coalesce((select max(id) from public.priceLists),   1));
select setval(pg_get_serial_sequence('public.prices',       'id'), coalesce((select max(id) from public.prices),       1));
select setval(pg_get_serial_sequence('public.invoices',     'id'), coalesce((select max(id) from public.invoices),     1));
select setval(pg_get_serial_sequence('public.invoiceItems', 'id'), coalesce((select max(id) from public.invoiceItems), 1));
select setval(pg_get_serial_sequence('public.ledger',       'id'), coalesce((select max(id) from public.ledger),       1));

commit;

-- Nota: si tu tabla usa IDENTITY en vez de SERIAL, pg_get_serial_sequence
-- sigue funcionando en Pg 13+. Si no, puedes localizar el nombre de la 
-- secuencia con: 
--   SELECT s.relname FROM pg_class s
--   JOIN pg_depend d ON d.objid = s.oid
--   JOIN pg_class t ON d.refobjid = t.oid
--   WHERE t.relname = '<tabla>' AND d.deptype = 'i';