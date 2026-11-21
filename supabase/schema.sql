-- Trainingsbuch: Tabellen und Schutzregeln
-- In Supabase unter "SQL Editor" einfügen und auf "Run" drücken.
-- Jede Zeile gehört genau einem Konto (user_id). Die Schutzregeln (RLS)
-- sorgen dafür, dass jedes Konto nur seine eigenen Zeilen sehen und ändern kann.

create table if not exists bouldern (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  datum date not null,
  dauer_min int,
  tops text,            -- "7a:4;7b:1"
  projekte text,        -- gleiches Format
  max_grad text,        -- z. B. "7a+"
  avg_hf int,
  kcal int,
  energie_1_5 smallint check (energie_1_5 between 1 and 5),
  notiz text,
  quelle text
);

create table if not exists kraft (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  datum date not null,
  uebung text not null,
  satz int,
  wdh int,
  gewicht_kg numeric(6,2),
  dauer_s int,          -- für Haltübungen
  notiz text
);

create table if not exists laufen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  datum date not null,
  uhrzeit time,
  dauer_s int,
  distanz_km numeric(6,2),
  pace_s_km int,
  avg_hf int,
  max_hf int,
  kcal int,
  hoehenmeter int,
  zone_leicht_min numeric(6,1),
  zone_mittel_min numeric(6,1),
  zone_intensiv_min numeric(6,1),
  zone_hoechst_min numeric(6,1),
  cardio_belastung int,
  splits text,          -- "8:11|9:03|…"
  energie_1_5 smallint check (energie_1_5 between 1 and 5),
  notiz text,
  quelle text
);

create table if not exists rad (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  datum date not null,
  uhrzeit time,
  dauer_s int,
  distanz_km numeric(6,2),
  avg_kmh numeric(5,1),
  avg_hf int,
  kcal int,
  hoehenmeter int,
  zweck text check (zweck in ('alltag','freizeit')),
  notiz text,
  quelle text
);

create table if not exists ernaehrung (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  datum date not null,
  lebensmittel text not null,
  menge text,
  kcal int,
  protein_g numeric(6,1),
  notiz text
);

create table if not exists zyklus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  periode_start date not null,
  periode_ende date,
  notiz text
);

create table if not exists befinden (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  datum_von date not null,
  datum_bis date,       -- leer = dauert an
  status text not null default 'krank',
  energie_1_5 smallint check (energie_1_5 between 1 and 5),
  notiz text
);

-- Schutzregeln: nur eigene Zeilen
do $$
declare t text;
begin
  foreach t in array array['bouldern','kraft','laufen','rad','ernaehrung','zyklus','befinden'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "nur eigene Zeilen" on %I', t);
    execute format('create policy "nur eigene Zeilen" on %I for all to authenticated
                    using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('revoke all on %I from anon', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('create index if not exists %I on %I (user_id)', t || '_user_idx', t);
  end loop;
end $$;
