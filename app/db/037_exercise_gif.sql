-- 037: ID->Hash-Mapping fuer Uebungs-GIFs.
--
-- Hintergrund: ExerciseDBs RapidAPI-Bild-Endpunkt (exercisedb.p.rapidapi.com/image)
-- liefert seit ~Juni 2026 nur noch Timeouts (deren Server-Ausfall, alle Aufloesungen/IDs).
-- Deshalb kommen die GIFs jetzt vom oeffentlichen jsDelivr-CDN ueber den Datensatz
-- hasaneyldrm/exercises-dataset (gleiche klassische IDs, gif_url = videos/{id}-{hash}.gif).
--
-- Diese Tabelle haelt je Uebungs-ID den Datei-Hash. Befuellt EINMALIG durch die Edge
-- Function `seed-exercise-gifs` (holt exercises.json vom CDN). Die Edge Function
-- `exercisedb-image` schlaegt hier den Hash nach und proxyt videos/{id}-{hash}.gif.
--
-- ZURUECK AUF 360: sobald ExerciseDBs /image-Endpunkt wieder antwortet, kann
-- `exercisedb-image` wieder direkt auf RapidAPI (resolution=360, Secret EXERCISEDB_KEY)
-- umgestellt werden; diese Tabelle wird dann nicht mehr gebraucht.

create table if not exists public.exercise_gif (
  id text primary key,
  hash text not null
);

alter table public.exercise_gif enable row level security;

-- Nicht sensibel (nur GIF-Dateinamen) -> oeffentlich lesbar; geschrieben wird nur
-- serverseitig (Service-Role) durch die Seed-Function.
drop policy if exists "exercise_gif_public_read" on public.exercise_gif;
create policy "exercise_gif_public_read" on public.exercise_gif for select using (true);
