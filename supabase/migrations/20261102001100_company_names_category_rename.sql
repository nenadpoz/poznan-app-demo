-- Firma: puno i skraćeno poslovno ime iz registracije (APR). Naziv (name) ostaje kratko ime u aplikaciji.
alter table public.companies
  add column legal_name text check (legal_name is null or length(legal_name) <= 300),
  add column short_name text check (short_name is null or length(short_name) <= 160);

-- Preimenovana kategorija prometa: postojeći unosi dobijaju novo ime (kategorija se na unosu čuva kao tekst)
create or replace function public.tx_category_rename() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update public.transactions set category = new.name
    where category = old.name and type = new.type and deleted_at is null;
  end if;
  return new;
end $$;
create trigger tx_category_rename after update of name on public.tx_categories
  for each row execute function public.tx_category_rename();
