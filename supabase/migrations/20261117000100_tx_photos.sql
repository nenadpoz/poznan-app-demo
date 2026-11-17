-- Slike uz promet (zahtev vlasnika 17. nov 2026.): uz prihod, trošak ili platu (`transaction`) i uz ulog vlasnika
-- (`contribution`) može jedna ili više slika (račun, faktura, kamion…). Dodaju se pri unosu ili izmeni, i brišu na izmeni.
-- Trošak plaćen iz više izvora ili valuta: slike stoje uz prvi red plaćanja.
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.photos'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%target_type%'
  loop
    execute format('alter table public.photos drop constraint %I', c);
  end loop;
end $$;
alter table public.photos add constraint photos_target_type_check
  check (target_type in ('client', 'supplier', 'job', 'task', 'transaction', 'contribution'));
