-- Questionnaire d'inscription des clients : écriture publique (envoi), lecture réservée au coach (code)
create table if not exists public.questionnaire_reponses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  prenom text not null,
  nom text,
  email text,
  statut text not null default 'nouveau' check (statut in ('nouveau','en_cours','programme_fait','archive')),
  note_coach text,
  data jsonb not null
);
alter table public.questionnaire_reponses enable row level security;
revoke all on public.questionnaire_reponses from anon, authenticated;

-- Code d'accès coach (hash bcrypt)
create table if not exists public.coaching_config (
  cle text primary key,
  valeur text not null
);
alter table public.coaching_config enable row level security;
revoke all on public.coaching_config from anon, authenticated;

create or replace function public._coach_ok(p_code text)
returns boolean language sql security definer stable set search_path = public, extensions as $$
  select exists(select 1 from public.coaching_config where cle = 'coach_code_hash'
                and valeur = extensions.crypt(coalesce(p_code,''), valeur));
$$;

-- Envoi d'un questionnaire (public)
create or replace function public.questionnaire_envoyer(p_data jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_prenom text;
begin
  if jsonb_typeof(p_data) <> 'object' then raise exception 'format'; end if;
  if pg_column_size(p_data) > 60000 then raise exception 'trop_volumineux'; end if;
  v_prenom := left(trim(coalesce(p_data->>'prenom','')), 60);
  if v_prenom = '' then raise exception 'prenom_requis'; end if;
  if (p_data->>'consentement') is distinct from 'true' then raise exception 'consentement_requis'; end if;
  -- anti-spam simple : 20 envois max par heure au total
  if (select count(*) from public.questionnaire_reponses where created_at > now() - interval '1 hour') >= 20 then
    raise exception 'trop_de_demandes';
  end if;
  insert into public.questionnaire_reponses(prenom, nom, email, data)
  values (v_prenom, left(trim(p_data->>'nom'),60), left(lower(trim(p_data->>'email')),120), p_data)
  returning id into v_id;
  return v_id;
end $$;

-- Lecture coach
create or replace function public.questionnaire_liste(p_code text)
returns setof public.questionnaire_reponses language plpgsql security definer set search_path = public as $$
begin
  if not public._coach_ok(p_code) then
    perform pg_sleep(1);
    raise exception 'code_invalide' using errcode = '28000';
  end if;
  return query select * from public.questionnaire_reponses order by created_at desc;
end $$;

-- Mise à jour du statut / note coach
create or replace function public.questionnaire_maj(p_code text, p_id uuid, p_statut text, p_note text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._coach_ok(p_code) then
    perform pg_sleep(1);
    raise exception 'code_invalide' using errcode = '28000';
  end if;
  update public.questionnaire_reponses
     set statut = coalesce(p_statut, statut), note_coach = coalesce(p_note, note_coach)
   where id = p_id;
  return found;
end $$;

revoke all on function public._coach_ok(text) from public, anon, authenticated;
revoke all on function public.questionnaire_envoyer(jsonb) from public;
revoke all on function public.questionnaire_liste(text) from public;
revoke all on function public.questionnaire_maj(text,uuid,text,text) from public;
grant execute on function public.questionnaire_envoyer(jsonb) to anon, authenticated;
grant execute on function public.questionnaire_liste(text) to anon, authenticated;
grant execute on function public.questionnaire_maj(text,uuid,text,text) to anon, authenticated;

-- Créer / changer le code coach (à lancer dans l'éditeur SQL, jamais dans le dépôt) :
-- insert into public.coaching_config(cle, valeur) values ('coach_code_hash', extensions.crypt('NOUVEAU_CODE', extensions.gen_salt('bf')))
--   on conflict (cle) do update set valeur = excluded.valeur;
