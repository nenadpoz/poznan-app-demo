-- Dogovorena cena posla (zahtev vlasnika 21. nov 2026.): svaki posao ima dogovorenu cenu po metru (npr. bušenje bunara),
-- broj metara (koliko je iskopano) i valutu cene. Ukupna cena = cena po metru × metri.
-- Kapara i ostale uplate su prihodi vezani za posao (transactions.job_id); dug = ukupna cena − uplaćeno.
-- Podsetnik za naplatu duga koristi postojeće job_reminders (baza šalje obaveštenje u izabrano vreme).
alter table public.jobs
  add column price_per_meter numeric(14,2) check (price_per_meter >= 0),
  add column meters numeric(10,2) check (meters >= 0),
  add column price_currency text not null default 'RSD' check (price_currency in ('RSD', 'EUR', 'USD'));
