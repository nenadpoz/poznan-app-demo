-- Iznosi bez decimala i za evre i dolare (zahtev vlasnika 22. nov 2026.), kao u aplikaciji (fmtCurrency):
-- tekst obaveštenja „1.235 EUR“ umesto „1.234,50 EUR“. Iznosi u bazi se ne menjaju, samo prikaz.
create or replace function public.fmt_amount(n numeric, cur text) returns text
language sql immutable as $$
  select replace(to_char(round(n), 'FM999,999,999,990'), ',', '.') || ' ' || cur
$$;
