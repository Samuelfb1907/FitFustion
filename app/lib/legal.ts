// Haftungsausschluss & Gesundheitshinweis (zentral, von Einstellungen + Registrierung genutzt).
// Hinweis: Vorlage, keine Rechtsberatung. Vor Release anwaltlich pruefen + Impressum/Datenschutz ergaenzen.
export const DISCLAIMER_VERSION = '1.0';

export const DISCLAIMER_SHORT =
  'FitFusion ersetzt keine ärztliche, ernährungs- oder trainingsbezogene Beratung. Nutzung auf eigene Gefahr. Bei Allergien immer die Zutaten selbst prüfen. Bei Beschwerden Training/Ernährung abbrechen und ärztlichen Rat einholen.';

// Kurz-Hinweise fuer den Essens-Tracker (mehrfach eingeblendet).
export const NUTRITION_DISCLAIMER =
  'Kalorien & Nährwerte sind geschätzte Richtwerte – keine Ernährungsberatung. FitFusion schlägt dir keine Lebensmittel vor; du trackst nur selbst.';
export const ALLERGY_HINT =
  '⚠️ Achte bei Allergien & Unverträglichkeiten immer selbst auf die Zutaten und Verpackungsangaben.';

export const DISCLAIMER_SECTIONS: { h: string; p: string }[] = [
  {
    h: '1. Keine medizinische oder professionelle Beratung',
    p: 'FitFusion ist eine reine Informations- und Motivations-App. Alle Inhalte – Trainingspläne, Übungen/Animationen, Kalorien- und Nährwertberechnungen, Ernährungs- und Rezeptvorschläge, Wasser-, Gewichts- und Fortschritts-Tracking – dienen ausschließlich allgemeinen Informationszwecken und stellen keine medizinische, ärztliche, physiotherapeutische oder ernährungsberaterische Beratung dar und ersetzen diese nicht.',
  },
  {
    h: '2. Ärztliche Rücksprache & Notfall',
    p: 'Halte vor Beginn Rücksprache mit einer Ärztin/einem Arzt – besonders bei Vorerkrankungen, Verletzungen, Herz-Kreislauf-Problemen, Ess-/Stoffwechselstörungen, in Schwangerschaft/Stillzeit oder bei Einnahme von Medikamenten. Brich bei Schmerzen, Schwindel oder Atemnot sofort ab. Im Notfall wähle den Notruf 112.',
  },
  {
    h: '3. Training auf eigene Gefahr',
    p: 'Übungen bergen ein Verletzungsrisiko. Du trainierst eigenverantwortlich und auf eigenes Risiko; achte auf korrekte Ausführung, passende Gewichte und deine persönlichen Grenzen. Die Animationen und Anleitungen sind allgemeine Beispiele und nicht auf deine individuelle Verfassung abgestimmt.',
  },
  {
    h: '4. Ernährung, Kalorien & Nährwerte',
    p: 'Kalorien- und Makroziele (z. B. nach Mifflin-St-Jeor) sind unverbindliche Richtwerte, keine individuelle Ernährungsplanung. Nährwertangaben können ungenau, veraltet oder unvollständig sein – teils, weil sie aus externen Quellen oder eigenen Eingaben stammen. Triff keine gesundheitsbezogenen Entscheidungen allein auf Basis dieser Werte.',
  },
  {
    h: '5. Allergien & Unverträglichkeiten — besonders wichtig',
    p: 'Die Allergie-Funktion ist eine Hilfestellung, keine Garantie. Die Erkennung erfolgt automatisiert anhand hinterlegter Zutaten und kann unvollständig oder fehlerhaft sein; manche Unverträglichkeiten (z. B. Histamin, Fruktose, Sulfite) und Kreuzkontaminationen werden nicht erfasst. Prüfe bei Allergien oder Unverträglichkeiten immer eigenständig alle Zutaten und Produkt-/Verpackungsangaben. Für allergische Reaktionen wird – soweit gesetzlich zulässig – keine Haftung übernommen.',
  },
  {
    h: '6. Inhalte und Daten Dritter',
    p: 'Die App nutzt Daten und Medien von Drittanbietern (u. a. Lebensmitteldaten, Übungs-Animationen). Für deren Richtigkeit, Vollständigkeit, Aktualität und Verfügbarkeit wird keine Gewähr übernommen.',
  },
  {
    h: '7. Keine Gewähr / Haftungsbeschränkung',
    p: 'Die Nutzung erfolgt auf eigenes Risiko. Für Schäden aus der Nutzung oder Nichtverfügbarkeit der App oder aus dem Vertrauen auf ihre Inhalte wird – soweit gesetzlich zulässig – keine Haftung übernommen. Unberührt bleibt die zwingende gesetzliche Haftung für Vorsatz, grobe Fahrlässigkeit sowie für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit; diese kann gesetzlich nicht ausgeschlossen werden.',
  },
  {
    h: '8. Eigenverantwortung',
    p: 'Mit der Nutzung von FitFusion bestätigst du, dass du diesen Hinweis gelesen und verstanden hast und die App eigenverantwortlich nutzt.',
  },
];

// Datenschutzerklaerung (Vorlage – Platzhalter [...] ausfuellen, vor Release anwaltlich pruefen).
export const PRIVACY_SECTIONS: { h: string; p: string }[] = [
  {
    h: 'Verantwortlicher',
    p: 'Verantwortlich für die Datenverarbeitung in FitFusion ist: [Name], [Anschrift], E-Mail: [Kontakt-E-Mail]. (Bitte vor Veröffentlichung ausfüllen.)',
  },
  {
    h: 'Welche Daten wir verarbeiten',
    p: 'Konto: E-Mail-Adresse. Profil: Vorname, Alter/Geburtsjahr, Geschlecht, Größe, Gewicht, Aktivitätslevel, Erfahrungslevel, Trainingsumgebung, Allergie-Angaben. Nutzungsdaten: Trainingseinheiten & Sätze, Trainingspläne, Essens-Tagebuch, Wasser- und Gewichtsverlauf, Erfolge. Einige davon sind Gesundheitsdaten (besondere Kategorie nach Art. 9 DSGVO).',
  },
  {
    h: 'Zwecke & Rechtsgrundlage',
    p: 'Wir verarbeiten die Daten ausschließlich, um dir die App-Funktionen bereitzustellen (Tracking, Auswertungen) – Rechtsgrundlage Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung). Gesundheitsbezogene Daten verarbeiten wir auf Grundlage deiner ausdrücklichen Einwilligung (Art. 9 Abs. 2 lit. a DSGVO), die du mit der Nutzung/Eingabe erteilst und jederzeit widerrufen kannst.',
  },
  {
    h: 'Hosting & Dienstleister',
    p: 'Deine Daten werden bei Supabase gespeichert (Datenbank, Authentifizierung, Hosting) – als Auftragsverarbeiter. Für Übungs-Animationen wird ExerciseDB (RapidAPI) und für Lebensmitteldaten Open Food Facts genutzt. Mit Auftragsverarbeitern ist ein Auftragsverarbeitungsvertrag (AVV) abzuschließen. [Bitte AVV mit Supabase abschließen.]',
  },
  {
    h: 'Speicherdauer',
    p: 'Wir speichern deine Daten, solange dein Konto besteht. Löschst du dein Konto (Einstellungen → Datenschutz → „Konto & alle Daten löschen"), werden deine personenbezogenen Daten entfernt.',
  },
  {
    h: 'Deine Rechte',
    p: 'Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie das Recht, eine erteilte Einwilligung zu widerrufen. Direkt in der App: „Meine Daten exportieren" (Auskunft/Portabilität) und „Konto & alle Daten löschen" (Löschung) unter Einstellungen → Datenschutz.',
  },
  {
    h: 'Beschwerderecht',
    p: 'Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren, wenn du der Ansicht bist, dass die Verarbeitung deiner Daten gegen die DSGVO verstößt.',
  },
  {
    h: 'Keine Werbung / keine automatisierten Entscheidungen',
    p: 'Wir geben deine Daten nicht zu Werbezwecken weiter und nutzen keine automatisierte Entscheidungsfindung oder Profiling mit rechtlicher Wirkung. Kontakt bei Fragen: [Kontakt-E-Mail].',
  },
];
