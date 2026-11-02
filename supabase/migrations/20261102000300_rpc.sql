-- RPC: radnje koje moraju biti jedna transakcija u bazi.

-- Broj fakture bez preskakanja i bez duplikata (dva telefona ne mogu dobiti isti broj)
create or replace function public.next_invoice_no(p_company uuid, p_year int) returns text
language plpgsql security definer set search_path = public as $$
declare n int; c_name text; prefix text;
begin
  if not public.is_admin() then raise exception 'Nema pristupa' using errcode = '42501'; end if;
  select name into c_name from public.companies where id = p_company;
  if c_name is null then raise exception 'Firma ne postoji'; end if;
  insert into public.invoice_counters as ic (company_id, year, last_no) values (p_company, p_year, 1)
  on conflict (company_id, year) do update set last_no = ic.last_no + 1
  returning last_no into n;
  -- Prefiks kao u @poznan/shared invoicePrefix: prva reč posle „Poznan“, dva slova
  select upper(left(coalesce((select w from unnest(regexp_split_to_array(c_name, '\s+')) w where lower(w) <> 'poznan' limit 1), c_name), 2))
    into prefix;
  return format('%s-%s-%s', prefix, p_year, lpad(n::text, 3, '0'));
end $$;

-- Dodeljuje broj fakture transakciji ili očekivanoj stavci (isti broj pri ponovnom preuzimanju)
create or replace function public.assign_invoice_no(p_kind text, p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare cur text; comp uuid; d date; no text;
begin
  if not public.is_admin() then raise exception 'Nema pristupa' using errcode = '42501'; end if;
  if p_kind = 'transaction' then
    select invoice_no, company_id, date into cur, comp, d from public.transactions
      where id = p_id and type = 'prihod' and client_id is not null for update;
  elsif p_kind = 'pending' then
    select i.invoice_no, i.company_id, current_date into cur, comp, d
      from public.job_pending_items i join public.jobs j on j.id = i.job_id
      where i.id = p_id and j.status = 'uplata' for update of i;
  else
    raise exception 'Nepoznata vrsta: %', p_kind;
  end if;
  if not found or comp is null then raise exception 'Faktura nije moguća za ovu stavku' using errcode = 'P0001'; end if;
  if cur is not null then return cur; end if;
  no := public.next_invoice_no(comp, extract(year from d)::int);
  if p_kind = 'transaction' then update public.transactions set invoice_no = no where id = p_id;
  else update public.job_pending_items set invoice_no = no where id = p_id; end if;
  return no;
end $$;

-- Završava posao: upisuje prihode (jedan po stavci) ili „bez naplate“ (prazan niz).
-- p_lines: [{"company_id": uuid|null, "amount": number, "description": text, "invoice_no": text|null}]
create or replace function public.finish_job(p_job uuid, p_lines jsonb, p_comment text default null, p_date date default current_date)
returns void language plpgsql security definer set search_path = public as $$
declare j public.jobs; l jsonb; cat text;
begin
  if not public.is_admin() then raise exception 'Nema pristupa' using errcode = '42501'; end if;
  select * into j from public.jobs where id = p_job and deleted_at is null for update;
  if not found then raise exception 'Posao ne postoji'; end if;
  if j.status = 'zavrseno' then raise exception 'Posao je već završen' using errcode = 'P0001'; end if;
  select coalesce(name, 'Usluga') into cat from public.labels where id = j.label_id;

  for l in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    if (l ->> 'amount')::numeric is null or (l ->> 'amount')::numeric <= 0 then
      raise exception 'Iznos mora biti veći od 0' using errcode = 'P0001';
    end if;
    insert into public.transactions (type, amount, date, company_id, client_id, job_id, category, description, invoice_no)
    values ('prihod', (l ->> 'amount')::numeric, p_date, nullif(l ->> 'company_id', '')::uuid, j.client_id, j.id,
            'Usluga', coalesce(nullif(l ->> 'description', ''), cat, 'Usluga'), nullif(l ->> 'invoice_no', ''));
  end loop;

  -- Očekivane stavke su zamenjene stvarnim prihodima
  update public.job_pending_items set deleted_at = now() where job_id = j.id and deleted_at is null;
  update public.job_reminders set deleted_at = now() where job_id = j.id and fired_at is null and deleted_at is null;

  perform set_config('poznan.via_rpc', 'on', true);
  update public.jobs set status = 'zavrseno', end_date = p_date,
    payment_comment = coalesce(p_comment, payment_comment) where id = j.id;
  perform set_config('poznan.via_rpc', 'off', true);
end $$;

-- „Čeka uplatu“: rad je završen, novac nije stigao. Upisuje očekivane stavke (zamenjuje postojeće).
create or replace function public.set_job_awaiting_payment(p_job uuid, p_lines jsonb, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare j public.jobs; l jsonb;
begin
  if not public.is_admin() then raise exception 'Nema pristupa' using errcode = '42501'; end if;
  select * into j from public.jobs where id = p_job and deleted_at is null for update;
  if not found then raise exception 'Posao ne postoji'; end if;
  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) = 0 then
    raise exception 'Izaberi bar jedan način naplate' using errcode = 'P0001';
  end if;

  update public.job_pending_items set deleted_at = now() where job_id = j.id and deleted_at is null and invoice_no is null;
  for l in select * from jsonb_array_elements(p_lines) loop
    if (l ->> 'amount')::numeric is null or (l ->> 'amount')::numeric <= 0 then
      raise exception 'Iznos mora biti veći od 0' using errcode = 'P0001';
    end if;
    -- Stavka sa već izdatom fakturom ostaje; menja se samo iznos i opis
    update public.job_pending_items set amount = (l ->> 'amount')::numeric, description = l ->> 'description'
      where job_id = j.id and deleted_at is null and invoice_no is not null
        and company_id is not distinct from nullif(l ->> 'company_id', '')::uuid;
    if not found then
      insert into public.job_pending_items (job_id, company_id, amount, description)
      values (j.id, nullif(l ->> 'company_id', '')::uuid, (l ->> 'amount')::numeric, l ->> 'description');
    end if;
  end loop;

  perform set_config('poznan.via_rpc', 'on', true);
  update public.jobs set status = 'uplata', payment_comment = coalesce(p_comment, payment_comment) where id = j.id;
  perform set_config('poznan.via_rpc', 'off', true);
end $$;

-- „Uplaćeno, posao završen“: očekivane stavke postaju prihodi (sa istim brojevima faktura)
create or replace function public.mark_job_paid(p_job uuid, p_date date default current_date)
returns void language plpgsql security definer set search_path = public as $$
declare lines jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('company_id', company_id, 'amount', amount, 'description', description, 'invoice_no', invoice_no)), '[]'::jsonb)
    into lines from public.job_pending_items where job_id = p_job and deleted_at is null;
  perform public.finish_job(p_job, lines, null, p_date);
end $$;

-- Promena faze firme sa datumom koji zadaje korisnik i opcionim komentarom
create or replace function public.change_company_phase(p_company uuid, p_phase text, p_date date, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  if not public.is_admin() then raise exception 'Nema pristupa' using errcode = '42501'; end if;
  select phase into cur from public.companies where id = p_company and deleted_at is null for update;
  if not found then raise exception 'Firma ne postoji'; end if;
  if cur = p_phase then return; end if;
  update public.companies set phase = p_phase where id = p_company;
  insert into public.company_history (company_id, kind, from_value, to_value, effective_date, note)
  values (p_company, 'phase', cur, p_phase, p_date, nullif(trim(p_note), ''));
end $$;

-- Podsetnici za uplatu: pg_cron poziva svakog minuta, notify-dispatch šalje push/email
create or replace function public.fire_due_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select * from public.job_reminders where fired_at is null and deleted_at is null and remind_at <= now() for update skip locked loop
    insert into public.notifications (to_user, from_user, type, target_type, target_id, text)
    select a.user_id, r.created_by, 'reminder', 'job', r.job_id,
           coalesce(r.note, 'Proveri uplatu: ' || (select replace(to_char(coalesce(sum(amount), 0), 'FM999,999,999,990'), ',', '.') || ' RSD'
                                                    from public.job_pending_items where job_id = r.job_id and deleted_at is null))
    from public.admins a where r.audience = 'both' or a.user_id = r.created_by;
    update public.job_reminders set fired_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function public.fire_due_reminders() from authenticated, anon;
grant execute on function public.next_invoice_no(uuid, int), public.assign_invoice_no(text, uuid),
  public.finish_job(uuid, jsonb, text, date), public.set_job_awaiting_payment(uuid, jsonb, text),
  public.mark_job_paid(uuid, date), public.change_company_phase(uuid, text, date, text) to authenticated;
