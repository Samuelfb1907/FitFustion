-- ============================================================================
--  Migration 031 - "Kein Equipment" wirklich nur Koerpergewicht
--  Viele Uebungen sind als "bodyweight" gefuehrt, brauchen aber doch ein Geraet/
--  Moebel (Klimmzugstange, Dip-Barren, Bank, Stuhl, Treppe, Theraband, Handtuch,
--  Seil, Fixierung der Fuesse). Diese auf 'other' setzen -> tauchen bei
--  "Kein Equipment" (bodyweight/none) NICHT mehr auf, bleiben aber bei Home-Gym/Studio.
--  GIFs/Namen bleiben unveraendert (GIF wird ueber den Namen aufgeloest).
--  Im SQL Editor mit KORREKTER UTF-8-Kodierung einfuegen (Umlaute!). Idempotent.
-- ============================================================================
update public.exercises set equipment = 'other' where name in (
  -- Klimmzugstange / unter einer Stange rudern
  'Klimmzüge','Negativ-Klimmzüge','Klimmzug breit','Chin-ups','Bizeps-Klimmzug',
  'Enge Bizeps-Klimmzüge','Schulterblatt-Klimmzug','Hängendes Knieheben','Beinheben hängend',
  'Umgekehrtes Rudern','Klimmzüge (Neutralgriff)','Enger Klimmzug (paralleler Griff)',
  'Klimmzug (Kammgriff)','Umgekehrtes Rudern (Knie gebeugt)','Archer-Klimmzug',
  'Einarmiger Klimmzug','Muscle-up',
  -- Dip-Barren / zwischen Baenken / Stuhl
  'Dips (Barren)','Trizeps-Dips (Bank)','Trizeps-Dips (zwischen Bänken)',
  'Bank-Dips (Knie gebeugt)','Trizeps-Dips (Stuhl)','Einarmige Dips',
  -- Bank / Erhoehung (schraeg/negativ) / Hyperextension
  'Hyperextensions','Hüftstrecken auf der Bank','Crunch auf der Schrägbank',
  'Schräg-Liegestütze','Negativ-Liegestütze','Enge Schräg-Liegestütze',
  -- Treppe / Sprungseil
  'Seilspringen','Wadenheben auf der Treppe',
  -- Handtuch
  'Isometrische Curls (Handtuch)','Einarmiges Handtuch-Rudern',
  -- Theraband
  'Bizeps-Curl mit Theraband','Konzentrationscurl mit Theraband','Überkopf-Bizepscurl mit Theraband',
  'Seitheben mit Theraband','Frontheben mit Theraband','Schulterdrücken mit Theraband',
  -- Fuesse fixieren / Partner
  'Beinbeuger am Boden','Assistierter Beinbeuger','Glute-Ham-Raise'
);
