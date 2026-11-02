-- Obrisana firma (deleted_at) skriva i svoj račun, pa nestaje iz stanja novca, unosa prometa i prenosa.
-- Vraćena firma vraća i račun. Naziv računa i dalje prati naziv firme.
create or replace function public.company_account() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.accounts (kind, company_id, name) values ('company', new.id, new.name);
    return new;
  end if;
  if new.name is distinct from old.name then
    update public.accounts set name = new.name where company_id = new.id;
  end if;
  if new.deleted_at is distinct from old.deleted_at then
    update public.accounts set deleted_at = new.deleted_at where company_id = new.id;
  end if;
  return new;
end $$;

drop trigger company_account on public.companies;
create trigger company_account after insert or update of name, deleted_at on public.companies
  for each row execute function public.company_account();

-- Već obrisane firme: sakrij i njihove račune
update public.accounts a set deleted_at = c.deleted_at
from public.companies c
where a.company_id = c.id and c.deleted_at is not null and a.deleted_at is null;
