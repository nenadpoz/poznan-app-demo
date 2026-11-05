-- Komentari i na prometu: prihod/trošak, prenos i ulog vlasnika (kao na poslu, zadatku i firmi).
-- Obaveštenja već primaju ove ciljeve (20261102001700), pa notify_comment radi bez izmene.
alter table public.comments drop constraint comments_target_type_check;
alter table public.comments add constraint comments_target_type_check
  check (target_type in ('task', 'job', 'company', 'transaction', 'transfer', 'contribution'));
