-- Postavljanje, promena i reset lozinke idu u logove (bez same lozinke).
-- Lozinka živi u auth.users, pa beleži trigger tamo; red u audit_log ima table_name 'nalog'.
create or replace function public.audit_password_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.encrypted_password is not distinct from old.encrypted_password then return new; end if;
  insert into public.audit_log (user_id, table_name, row_id, action, old, new)
  values (new.id, 'nalog', new.id::text, 'update', null, jsonb_build_object(
    'event', case
      when old.encrypted_password is null or old.encrypted_password = '' then 'Lozinka postavljena'
      when new.recovery_sent_at > now() - interval '1 hour' then 'Reset lozinke'
      else 'Lozinka promenjena' end,
    'email', new.email));
  return new;
end $$;
revoke execute on function public.audit_password_change() from authenticated, anon;

create trigger audit_password_change after update of encrypted_password on auth.users
  for each row execute function public.audit_password_change();
