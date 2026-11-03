-- Table de suivi (une ligne par athlète), accessible uniquement via les fonctions protégées par code PIN
create table if not exists public.coaching_suivi (
  athlete text primary key check (athlete in ('aya','camelia')),
  pin_hash text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.coaching_suivi enable row level security;
revoke all on public.coaching_suivi from anon, authenticated;

create or replace function public.coaching_get(p_athlete text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r public.coaching_suivi;
begin
  select * into r from public.coaching_suivi where athlete = p_athlete;
  if r is null or r.pin_hash <> extensions.crypt(p_pin, r.pin_hash) then
    raise exception 'code_invalide' using errcode = '28000';
  end if;
  return r.data;
end $$;

create or replace function public.coaching_save(p_athlete text, p_pin text, p_data jsonb)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare r public.coaching_suivi;
begin
  select * into r from public.coaching_suivi where athlete = p_athlete;
  if r is null or r.pin_hash <> extensions.crypt(p_pin, r.pin_hash) then
    raise exception 'code_invalide' using errcode = '28000';
  end if;
  if pg_column_size(p_data) > 200000 then raise exception 'trop_volumineux'; end if;
  update public.coaching_suivi set data = p_data, updated_at = now() where athlete = p_athlete;
  return true;
end $$;

revoke all on function public.coaching_get(text,text) from public;
revoke all on function public.coaching_save(text,text,jsonb) from public;
grant execute on function public.coaching_get(text,text) to anon, authenticated;
grant execute on function public.coaching_save(text,text,jsonb) to anon, authenticated;

-- Créer / changer un code (à lancer dans l'éditeur SQL, jamais dans le dépôt) :
-- insert into public.coaching_suivi(athlete, pin_hash) values ('aya', extensions.crypt('NOUVEAU_CODE', extensions.gen_salt('bf')))
--   on conflict (athlete) do update set pin_hash = excluded.pin_hash;
