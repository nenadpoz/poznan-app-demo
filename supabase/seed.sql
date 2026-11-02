-- Primer podataka za lokalni razvoj (`supabase db reset`). Nalozi se prave posebno (pozivnica).
insert into public.settings (id) values (true) on conflict do nothing;

insert into public.companies (id, name, form, phase, address, pib, mb, activity, icon) values
  ('00000000-0000-0000-0000-0000000000d1', 'Poznan Drill', 'pausal', 'aktivna', 'Industrijska 4, Šabac', '112233445', '66778899', 'Bušenje bunara', 'drill'),
  ('00000000-0000-0000-0000-0000000000d2', 'Poznan Trans', 'pausal', 'aktivna', 'Industrijska 4, Šabac', '112233446', '66778800', 'Drumski prevoz robe', 'truck');

insert into public.labels (name, color) values
  ('Bušenje bunara', 0), ('Servis pumpe', 1), ('Prevoz', 2), ('Iskop', 3), ('Ostalo', 5);

insert into public.clients (kind, name, city, address, phone) values
  ('fizicko', 'Dragana Petrović', 'Šabac', 'Kralja Petra 12', '+381 64 111 2233'),
  ('fizicko', 'Milan Jovanović', 'Bogatić', 'Vojvode Mišića 3', '+381 63 444 5566');
insert into public.clients (kind, name, city, address, pib, mb, email) values
  ('pravno', 'Agro Drina DOO', 'Loznica', 'Drinska 21', '109876543', '21345678', 'kancelarija@agrodrina.rs');
