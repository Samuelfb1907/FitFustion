# FitAvo - Audit vor Apple-Einreichung

Erstellt 2026-06-11. Quelle: Multi-Agenten-Audit (15 Pruefer + Gegenpruefung am Code + Vollstaendigkeits-Check).

**Bestaetigte Punkte: 67**  (BLOCKER: 2  |  HOCH: 7  |  MITTEL: 12  |  KLEIN: 38  |  IDEE: 8)

Verworfen (Fehlalarm in der Gegenpruefung): 5

---


## BLOCKER

### 1. is_premium umgehbar via DELETE+INSERT (Trigger nur BEFORE UPDATE)
- **Bereich:** db-rls-premium
- **Stelle:** `app/db/034_protect_is_premium.sql:29-32`
- **Problem:** Trigger ist before update on profiles (live per pg_get_triggerdef bestaetigt), greift nur bei UPDATE. profiles hat zusaetzlich profiles_delete_own (DELETE auth.uid()=id) und profiles_insert_own (INSERT auth.uid()=id) fuer authenticated (live pg_policy). Client-Angriff: profiles.delete().eq(id,myId), dann profiles.upsert mit is_premium true = reiner INSERT, den der BEFORE-UPDATE-Trigger nicht abfaengt. Live als Rolle authenticated mit JWT-sub in ROLLBACK-Transaktionen: direkter UPDATE blieb false, upsert-mit-Konflikt blieb false, aber delete+INSERT und delete+upsert ergaben is_premium=true. Webhook und parse-meal-Gate lesen diese Spalte; Nutzer schaltet sich kostenlos Premium frei.
- **Loesung:** is_premium auch beim INSERT erzwingen: Trigger auf before insert or update erweitern und bei TG_OP=INSERT durch Client-Rollen is_premium:=false setzen (old ist bei INSERT null, per TG_OP trennen). Zusaetzlich revoke insert(is_premium),update(is_premium) on profiles from authenticated,anon. Optional DELETE-Policy ueberdenken (Konto-Loeschung laeuft serverseitig ueber delete-account Edge Function). Danach delete+insert als authenticated erneut testen.

### 2. Migration 013 (plan_schedule) live nicht angewendet -> Wochenplan + DSGVO-Loeschung brechen
- **Bereich:** db-rls-premium
- **Stelle:** `app/db/013_plan_schedule.sql:6 / PlanScreen.tsx:186 / HomeScreen.tsx:86 / gdpr.ts:6`
- **Problem:** to_regclass(public.plan_schedule)=NULL live, Tabelle fehlt, obwohl 017/022/025/026/027/033/034 angewendet sind (live geprueft) - gezielt 013 fehlt. PlanScreen (heute angefasstes assignDay, Z.186-188) und HomeScreen (Z.86) lesen/schreiben plan_schedule -> PGRST205 relation does not exist im Build, Wochenplan kaputt. gdpr.ts deleteAllUserData hat plan_schedule in USER_TABLES (Z.6) -> delete schlaegt fehl, landet in failed -> DSGVO-Loeschung meldet faelschlich ok=false.
- **Loesung:** 013_plan_schedule.sql auf der Live-DB ausfuehren (idempotent) und pruefen, dass alle Migrationen 002-034 wirklich angewendet sind. Vor dem Build to_regclass-Check ueber alle erwarteten Tabellen.


## HOCH

### 3. App-Privacy-Labels (Health/Fitness, Nutzerinhalt an Anthropic/USA, Kaeufe) muessen in App Store Connect deklariert werden
- **Bereich:** apple-guidelines
- **Stelle:** `APP-STORE-CHECKLIST.md:8-34`
- **Problem:** Die App erhebt Gesundheits-/Fitnessdaten (Gewicht, Groesse, Training, Kalorien), sensible Daten (Geschlecht, Geburtsdatum), Kontaktdaten (E-Mail), Nutzerinhalte (Mahlzeiten-Freitext, der laut parse-meal/index.ts:121-131 an api.anthropic.com/USA gesendet wird) und Kauf-Status. App-Privacy-Angaben sind bei der Submission verbindlich; fehlende/falsche Labels sind ein haeufiger Ablehnungsgrund. Die Checkliste fuehrt die Datenarten korrekt auf, aber die Eintragung in ASC ist eine externe, noch offene Aktion. Fuer TestFlight nicht hart blockierend.
- **Loesung:** In App Store Connect, App-Datenschutz, die in APP-STORE-CHECKLIST.md Abschnitt 1 gelisteten Datenarten exakt eintragen; insbesondere Nutzerinhalte (Mahlzeiten-Text) als an Dritte (Anthropic) uebermittelt und Health/Fitness als mit Konto verknuepft, kein Tracking. Datenschutz-URL und EULA-URL hinterlegen.

### 4. EU-DSA Trader-Status (Pflicht bei In-App-Kaeufen in der EU) noch offen
- **Bereich:** apple-guidelines
- **Stelle:** `APP-STORE-CHECKLIST.md:39`
- **Problem:** Bei einer App mit In-App-Kaeufen, die in der EU vertrieben wird, verlangt Apple seit dem Digital Services Act die Angabe des Haendler-/Trader-Status in App Store Connect. Ohne diese Angabe wird die App aus den EU-Stores entfernt bzw. nicht freigegeben. Externe ASC-Eingabe (nicht im Code), vor der oeffentlichen Submission zwingend; fuer reines TestFlight ohne Public-Distribution nicht blockierend.
- **Loesung:** In App Store Connect unter App-Informationen den Trader-Status (Name, Adresse, Telefon, E-Mail von Samuel Sinemli) ausfuellen. Adresse/Kontakt stehen konsistent in legal.ts (IMPRESSUM_SECTIONS) bereit.

### 5. Auto-renewable Abo-Produkt muss in ASC angelegt und im RevenueCat-Offering verknuepft sein
- **Bereich:** apple-guidelines
- **Stelle:** `APP-STORE-CHECKLIST.md:45`
- **Problem:** purchases.ts:67-77 holt das Monats-Paket aus offerings.current.monthly bzw. availablePackages[0]. Gibt es kein current-Offering mit einem an ein ASC-Abo gebundenen Package, liefert getPremiumPackage() null und purchasePremium() gibt unavailable zurueck, sodass die Paywall dauerhaft Noch nicht verfuegbar zeigt. MEMORY nennt Offering/Entitlement als evtl. noch nicht final. Fuer TestFlight nur ok, wenn kein echter Kauf getestet wird; fuer Submission und sinnvollen Beta-Test ein Muss.
- **Loesung:** In ASC ein auto-renewable Abo (9,99 EUR/Monat, z.B. fitavo_premium_monthly) anlegen, in RevenueCat an das Entitlement premium (purchases.ts:20) binden und in ein als current markiertes Offering mit monthly-Package legen. Entitlement-Bezeichner exakt premium belassen.

### 6. Demo-/Review-Konto fuer App Review noch Platzhalter
- **Bereich:** apple-guidelines
- **Stelle:** `APP-STORE-CHECKLIST.md:58-60`
- **Problem:** Die Review-Notizen-Vorlage enthaelt review@fitavo.eu und Sternchen als Platzhalter. Die App hat kein Sign-in-with-Apple (reines E-Mail+Passwort, korrekt da kein Social-Login, 4.8 nicht anwendbar) und steht hinter Login. Bei der Submission muss ein echtes Demo-Konto mit aktivem Premium hinterlegt werden, sonst 2.1-Ablehnung, weil der Pruefer die Premium-Funktionen nicht sieht. MEMORY: Konto Samuel-sinemli@gmx.de ist bereits is_premium=true und damit als Demo-Konto nutzbar. Fuer TestFlight nicht relevant.
- **Loesung:** Vor Submission echtes Premium-Demo-Konto (z.B. das bereits auf is_premium=true gesetzte Testkonto) in App Review Information, Notes, eintragen.

### 7. Kein Gratis-Test/Trial - Paywall ist eine harte Wand, widerspricht dem eigenen Funnel
- **Bereich:** business-ceo
- **Stelle:** `app/lib/purchases.ts:67-77, app/components/Paywall.tsx:59-76`
- **Problem:** purchasePremium() holt nur current.monthly (oder availablePackages[0]) und kauft sofort - es gibt keine Trial-/Intro-Phase und keinen entsprechenden Hinweis in der Paywall. Der eigene Business-Plan (build/content.json:445) sieht jedoch ausdruecklich einen Funnel 'Install -> Onboarding -> aktiver Nutzer -> Trial -> Premium' vor, und content.json:31/433 kalkuliert mit 3-6% Free->Premium-Conversion. Bei einer 9,99-EUR-Hard-Paywall ohne Trial ist diese Conversion-Annahme unrealistisch. Apple/RevenueCat unterstuetzen Intro-Offers nativ; purchasePremium() wuerde eine Trial automatisch mitnehmen, sobald das Offering eine Intro-Phase hat - es fehlt aber die Konfiguration UND die Pflicht-Offenlegung der Trial-Bedingungen nahe dem CTA.
- **Loesung:** 7-tage-Trial als introductory offer am Abo in App Store Connect + RevenueCat anlegen. Paywall-Copy anpassen ('7 Tage kostenlos, danach 9,99 EUR/Monat, jederzeit kuendbar') und die Trial-Bedingungen in den fineprint (Paywall.tsx:140-142) aufnehmen (Apple verlangt klare Offenlegung nahe dem Kauf-Button). purchasePremium() bleibt unveraendert, da RevenueCat die Eligibility selbst handhabt. Nicht TestFlight-blockierend, aber direkter Umsatz-Hebel.

### 8. Kein Jahres-/Lifetime-Abo in der App, obwohl der Business-Plan beide vorsieht
- **Bereich:** business-ceo
- **Stelle:** `app/lib/purchases.ts:73, build/content.json:419-421`
- **Problem:** build/content.json:32 und 419-421 fuehren als Geschaeftsmodell explizit 'Premium 9,99 EUR/Monat; 59,99 EUR/Jahr (~5 EUR/Monat); 199 EUR Lifetime' und nennen das Jahresabo 'beste Bindung'. Der App-Code bietet aber nur ein Monatsprodukt an: getPremiumPackage() liest hart 'current.monthly' bzw. availablePackages[0]; die Paywall (Paywall.tsx) zeigt nur EINEN Preis (PREMIUM_PRICE = '9,99 EUR / Monat'). Ein Jahresabo ist der staerkste Hebel gegen die im Plan angenommene Monats-Churn von 5-8% (content.json:441) und hebt den LTV deutlich. Reines Monatsabo laesst Umsatz/Retention liegen.
- **Loesung:** Mindestens ein Jahresabo (z. B. 59,99 EUR/Jahr) in App Store Connect + RevenueCat-Offering anlegen und in der Paywall als zweite Option mit Ersparnis-Badge ('~5 EUR/Monat, 50% guenstiger') anbieten. getPremiumPackage()/Paywall auf Paket-Auswahl (monthly vs. annual) erweitern. Fuer das erste TestFlight nicht zwingend, aber vor PUBLIC-Release wirtschaftlich wichtig.

### 9. Cross-cutting: Nach erfolgreichem Kauf wird profiles.is_premium NICHT reconciled -> KI (parse-meal) antwortet 403, obwohl die App "Premium aktiv" zeigt
- **Bereich:** critic
- **Stelle:** `app/components/Paywall.tsx:64 / app/screens/FoodTrackerScreen.tsx:281 / supabase/functions/parse-meal/index.ts:76`
- **Problem:** Der Client-Premium-Status ist isPremium = rcPremium || profile.is_premium (AuthContext.tsx:139). Nach purchasePremium() in Paywall.tsx (Z.62-66) wird bei 'success' nur ein Alert gezeigt und geschlossen; rcPremium kippt via addCustomerInfoUpdateListener auf true, also zeigt die App SOFORT Premium frei. ABER der Server (parse-meal/index.ts:76-79) gated ausschliesslich auf profiles.is_premium aus der DB. Dieses Feld setzt NUR der RevenueCat-Webhook (revenuecat-webhook/index.ts:50). Solange der Webhook nicht gefeuert/verarbeitet ist (oder - laut Bekannt-Offen - der test_-Key im TestFlight-Build verwendet wird, dessen Store-Webhook-Pfad ungesichert ist), bleibt is_premium=false. Folge: recognizeMeal() (FoodTrackerScreen.tsx:281) sieht isPremium=true (rcPremium), ueberspringt die Paywall, ruft parse-meal auf -> 403 'premium_required'. Im Client wird daraus die generische Meldung 'Erkennung gerade nicht verfuegbar' (FoodTrackerScreen.tsx:307). Der zahlende/testende Nutzer hat 'Premium' in der App, aber die KI funktioniert nicht. Dies ist genau der angefragte Widerspruch und ist real.
- **Loesung:** Nach 'success' in Paywall.handlePurchase() refreshProfile() (aus useAuth) aufrufen UND idealerweise serverseitig absichern: parse-meal sollte als Fallback bei prof.is_premium!==true zusaetzlich das RevenueCat-Entitlement pruefen ODER der Client-Kaufabschluss schreibt is_premium nicht (das macht der Webhook), aber der Premium-Gate in parse-meal sollte fuer einen kurzen Moment fail-open/karenz sein. Mindestens: Webhook VOR TestFlight verifizieren (mit echtem appl_-Key + Sandbox), sonst ist KI fuer alle Tester kaputt.


## MITTEL

### 10. Regression: useFocusTick ruft die jetzt-werfenden Loader ohne catch -> unhandled rejection + still verschluckter Fehler
- **Bereich:** regression-screens-food-home
- **Stelle:** `app/screens/FoodTrackerScreen.tsx:110-117`
- **Problem:** Heute wurden loadLogs/loadQuick/loadUsual/loadFavorites von 'Fehler verschlucken' auf 'throw' umgestellt (L197,208,232,412 mit 'if (error) throw error'). Im Kaltstart ist das sauber gefangen (init() hat try/catch, L161-186). Der useFocusTick-Callback ruft die vier Loader aber direkt und ungefangen auf: 'loadLogs(); loadQuick(); loadFavorites(); loadUsual();'. useFocusTick fuehrt fn() synchron aus (app/lib/useFocusTick.ts:10) und es gibt KEINEN globalen unhandledRejection-Handler (per Grep verifiziert). Bei jedem erneuten Antippen des Essen-Reiters fuehrt ein transienter Fehler (Netz/RLS) damit zu einer 'Possible unhandled promise rejection' (Dev: LogBox/Red-Box; Release: nur geloggt). Schlimmer fuer die UX: der Fehler loest KEIN setLoadError aus -> der Nutzer bekommt beim Refresh-Pfad gar nichts angezeigt, also genau das, was der heutige Fix eigentlich beheben sollte (nur halb umgesetzt).
- **Loesung:** Im useFocusTick-Callback die Loader buendeln und fangen, z. B. 'Promise.all([loadLogs(),loadQuick(),loadFavorites(),loadUsual()]).catch((e)=>setLoadError(errorMessage(e)))' – oder den vorhandenen init(true) wiederverwenden (der bereits try/catch hat) statt der vier Einzelaufrufe.

### 11. Regression: Mutations-Handler (quickAdd/addLog/addUsual/applyNlItems/applyFavorite) laden nach dem Schreiben ungefangen neu
- **Bereich:** regression-screens-food-home
- **Stelle:** `app/screens/FoodTrackerScreen.tsx:361-375`
- **Problem:** Selbe Ursache wie oben, breiter gestreut. quickAdd (L370-371), addLog (L400-401), addUsual (L272-273), applyNlItems (L355), applyFavorite (L462) rufen nach erfolgreichem INSERT 'await loadLogs()/loadQuick()/...' innerhalb von 'try { ... } finally { busyRef.current=false }' OHNE catch auf (per Grep verifiziert: zwischen L272/355/370/400/462 steht jeweils nur 'finally', kein 'catch'). saveFavorite (L451), doDeleteFavorite (L474), doDeleteLog (L486) rufen loadFavorites()/loadLogs() sogar voellig ohne try auf. Folge: Wenn das Nachladen nach einer geglueckten Aktion fehlschlaegt, wirft der nun werfende Loader -> unhandled rejection; der busyRef wird per finally zwar korrekt zurueckgesetzt (kein Dauer-Lock), aber der Nutzer sieht weder den neuen Eintrag noch eine Fehlermeldung (stale UI). Kein Crash im Release-Build, daher high statt blocker.
- **Loesung:** Die Nachlade-Aufrufe in diesen Handlern in try/catch packen (Fehler ueber setError/setLoadError sichtbar machen) oder eine kleine Hilfsfunktion 'reloadDiary()' mit eigenem catch einfuehren und ueberall statt der nackten await-Aufrufe verwenden.

### 12. Kalorien-Tagesziel inkonsistent: FoodTracker addiert Training+Aktivitaet, HomeScreen nimmt Math.max (Doppelzaehlung)
- **Bereich:** regression-screens-food-home
- **Stelle:** `app/screens/FoodTrackerScreen.tsx:550`
- **Problem:** FoodTracker: 'const effTarget = targetKcal + trainingKcal + activityKcal' (L550), HomeScreen: 'nutrition.targetCalories + Math.max(trainingKcal, activityKcal)' (L230 Gauge und L275 Tagesziele). trainingKcal (Session-Dauer-Schaetzung, lib/trainingBonus.ts) und activityKcal (gemessene/aus Schritten geschaetzte Aktivkalorien, lib/health.ts getTodayActivity) ueberschneiden sich physisch: ein per Smartwatch gemessenes Training zaehlt sowohl in ActiveCaloriesBurned (->activityKcal) als auch in die Dauer-Schaetzung (->trainingKcal). HomeScreen wurde deshalb in einem frueheren Audit bewusst auf Math.max gestellt (Commit 31ec595 'fix(audit): Kalorien-Doppelzaehlung'); FoodTracker wurde dabei NICHT mitgezogen. Ergebnis: An Tagen mit getracktem UND gemessenem Training zeigen Home und Tracker unterschiedliche Tagesziele, und der Tracker zaehlt die Trainingskalorien doppelt. Nicht durch den heutigen Batch entstanden, aber eine echte Berechnungsabweichung.
- **Loesung:** In FoodTrackerScreen effTarget auf dieselbe Logik wie HomeScreen bringen: 'targetKcal + Math.max(trainingKcal, activityKcal)' (und die Bonuszeile L836-840 analog anpassen, damit sie nicht trainingKcal+activityKcal summiert).

### 13. is_premium kann nach Abo-Ablauf dauerhaft true bleiben (Herabstufung haengt allein am EXPIRATION-Webhook)
- **Bereich:** new-purchases-context-app
- **Stelle:** `app/contexts/AuthContext.tsx:139`
- **Problem:** Frage aus dem Auftrag explizit geprueft: isPremium = rcPremium || !!profile.is_premium. Wer setzt is_premium je auf FALSE? Nur der revenuecat-webhook bei EXPIRATION oder SUBSCRIPTION_PAUSED (supabase/functions/revenuecat-webhook/index.ts:23,50). Der Client kann is_premium dank Migration 034-Trigger NICHT mehr aendern (verifiziert, korrekt). Folge: Wenn der Webhook im RevenueCat-Dashboard nicht (oder mit falschem Secret/URL) konfiguriert ist, ODER ein EXPIRATION-Event verloren geht (RevenueCat retryt zwar, aber ein dauerhafter 401/500 oder ein zwischenzeitlich geaendertes Secret fuehrt zu verlorenem Event), bleibt profiles.is_premium fuer immer true -> Nutzer behaelt Premium gratis nach Ablauf. rcPremium (RevenueCat-Listener) wuerde zwar korrekt false, aber das ODER mit dem veralteten DB-Wert haelt isPremium true. Zusaetzlich: Das Testkonto Samuel-sinemli@gmx.de (serverseitig is_premium=true ohne echten Kauf) ist absichtlich dauerhaft premium - das ist ok, illustriert aber genau diesen Pfad.
- **Loesung:** Vor PUBLIC-Release haerten (fuer TestFlight tolerierbar): (a) Im RevenueCat-Dashboard Webhook + EXPIRATION zwingend einrichten und mit einem echten Sandbox-Ablauf testen; (b) optional einen taeglichen Reconcile-Job (Edge Function/Cron), der profiles.is_premium gegen den RevenueCat-Subscriber-Status oder ein gespeichertes expires_date abgleicht; (c) bei BILLING_ISSUE bewusst NICHT herabstufen ist ok (Grace Period), aber EXPIRATION-Zustellung absichern.

### 14. revenuecat-webhook: keine Reihenfolge-Absicherung -> verspaeteter EXPIRATION-Event kann zahlendes Konto faelschlich auf is_premium=false setzen
- **Bereich:** edge-functions
- **Stelle:** `supabase/functions/revenuecat-webhook/index.ts:42-50`
- **Problem:** Die Function setzt is_premium per reinem Last-Write-Wins ('update is_premium = premium where id = appUserId'), ohne den Event-Zeitstempel (event.event_timestamp_ms) zu beruecksichtigen. RevenueCat garantiert KEINE Zustellreihenfolge und liefert Events teils mehrfach/verzoegert. Szenario: RENEWAL (neu) trifft zuerst ein -> is_premium=true; ein vorher ausgeloester, aber verzoegerter EXPIRATION (alt) trifft danach ein -> is_premium=false, obwohl das Abo aktiv ist. Folge: zahlender Nutzer verliert Premium bis zum naechsten ACTIVE-Event. Reiner Korrektheits-/UX-Bug, kein Sicherheitsleck. Fuer TestFlight selten, in Produktion real.
- **Loesung:** Idempotent + monoton machen: entweder den Premium-Status bei jedem Webhook aus event.entitlements/expiration_at_ms ableiten (statt aus dem Event-Typ) ODER eine Spalte premium_event_at (event_timestamp_ms) auf profiles fuehren und das Update nur anwenden, wenn der neue Event juenger ist als der gespeicherte. Alternativ in einer Folge-Iteration vor PUBLIC-Release.

### 15. revenuecat-webhook: anonyme app_user_id matcht keine Profilzeile -> Kauf vor Login schaltet Premium serverseitig nicht frei
- **Bereich:** edge-functions
- **Stelle:** `supabase/functions/revenuecat-webhook/index.ts:39-50`
- **Problem:** Die Function nimmt an, dass event.app_user_id == Supabase-User-UUID ist (Kommentar Zeile 14), weil die App Purchases.logIn(user.id) ruft (verifiziert in app/lib/purchases.ts:50 und AuthContext.tsx:112). RevenueCat sendet jedoch auch Webhooks fuer ANONYME IDs ('$RCAnonymousID:...') — z. B. wenn ein Kauf vor dem logIn passiert, sowie bei TRANSFER-Events. Dann ist appUserId KEINE gueltige UUID, das 'update ... .eq(id, appUserId)' trifft 0 Zeilen, supabase-js liefert KEINEN Fehler (error=null) -> Function antwortet 200 'ok', obwohl nichts gesetzt wurde. is_premium bleibt false, bis ein spaeterer Event mit der echten UUID kommt. Da der Client (AuthContext) Premium zusaetzlich aus rcPremium (RevenueCat direkt) ableitet, faellt das in der App meist nicht auf — aber das serverseitige parse-meal-Gate (das NUR profiles.is_premium liest) wuerde solche Nutzer faelschlich mit 403 sperren.
- **Loesung:** appUserId vor dem Update als UUID validieren und nicht-UUID/Anonymous-IDs bewusst ignorieren (200 'ok (anon)'), damit klar ist, dass nichts passiert. Mittelfristig TRANSFER/alias-Events behandeln oder das Mapping ueber RevenueCats 'original_app_user_id'/alias-Liste aufloesen. Da das parse-meal-Gate bei fehlender Zeile fail-open ist, ist die App-Funktion abgesichert; das Risiko ist 'Premium wird serverseitig nicht persistiert'.

### 16. Datenschutzerklaerung verschweigt oeffentliche Bestenliste (display_name als Empfaenger-/Offenlegungs-Verarbeitung)
- **Bereich:** legal-de
- **Stelle:** `app/lib/legal.ts:84-85`
- **Problem:** Die Bestenliste ist ein Premium-Feature, das laut AGB (legal.ts:166 'Teilnahme an der Bestenliste') und Code real existiert: 017_leaderboard.sql legt leaderboard_entries mit einem display_name an, 021/023_leaderboard_view.sql exponieren diesen ueber eine View, und LeaderboardScreen.tsx:186 zeigt s.row.display_name ALLEN Teilnehmern an. gdpr.ts:24/39 exportiert/loescht leaderboard_entries explizit. Damit wird ein vom Nutzer gewaehlter Anzeigename gegenueber Dritten (anderen Nutzern) offengelegt. Der Abschnitt 'Welche Daten wir verarbeiten' (legal.ts:85) zaehlt Konto/Profil/Nutzungsdaten auf, erwaehnt die Bestenlisten-Teilnahme und die oeffentliche Sichtbarkeit des Anzeigenamens aber mit keinem Wort; auch der Abschnitt 'Keine Werbung / keine automatisierten Entscheidungen' nennt keine Empfaenger. Art. 13 Abs. 1 lit. e DSGVO verlangt die Nennung von Empfaengern/Empfaengerkategorien; eine fuer andere Nutzer sichtbare Rangliste ist eine solche Offenlegung. Opt-in (Premium + aktives Beitreten), daher kein Blocker, aber eine echte Transparenzluecke.
- **Loesung:** In PRIVACY_SECTIONS einen Satz ergaenzen: dass bei freiwilliger Teilnahme an der Bestenliste ein selbstgewaehlter Anzeigename und ein Punktestand fuer andere Nutzer sichtbar sind, mit Rechtsgrundlage Einwilligung/Vertrag, und dass die Teilnahme jederzeit beendet werden kann (Eintrag wird bei Konto-/Datenloeschung entfernt).

### 17. Art.9-Einwilligung beim Signup nur lokal (AsyncStorage) – kein serverseitiger, versionierter Nachweis zum Registrierungszeitpunkt
- **Bereich:** legal-de
- **Stelle:** `app/screens/AuthScreen.tsx:62`
- **Problem:** Beim Signup wird die Zustimmung (health/terms/privacy + DISCLAIMER_VERSION + Zeitpunkt) ausschliesslich in AsyncStorage('fitavo.disclaimerAccepted') geschrieben. Der einzige serverseitige Nachweis (profiles.disclaimer_version + consented_at, Migration 025) entsteht erst beim Abschluss des Onboardings (OnboardingScreen.tsx:128) und ist dort best-effort (kein await-Fehlerhandling, schlaegt ohne Migration 025 still fehl). Folgen fuer den Art.9-Nachweis: (a) Ein Nutzer, der sich registriert, aber das Onboarding nie beendet, hinterlaesst serverseitig KEINEN Einwilligungsnachweis. (b) AsyncStorage ist geraetelokal und wird bei App-Loeschung/Geraetewechsel verworfen – als Rechenschaftsnachweis (Art. 5 Abs. 2, Art. 7 Abs. 1 DSGVO) faktisch wertlos. (c) consented_at speichert nur DISCLAIMER_VERSION ('1.1'), nicht aber, welche AGB-/Datenschutz-Fassung (legal.ts: 'Stand 10. Juni 2026') akzeptiert wurde. Bei einer Behoerden-/Nutzeranfrage laesst sich die konkrete Einwilligung damit nicht belastbar belegen.
- **Loesung:** Die ausdrueckliche Einwilligung bereits unmittelbar nach erfolgreichem signUp serverseitig protokollieren (profiles.consented_at/disclaimer_version setzen bzw. eine eigene consent_log-Zeile schreiben, sobald UID vorliegt) und dabei eine Datenschutz-/AGB-Versionskennung mitfuehren. Den Onboarding-Schreibvorgang nicht als alleinigen Nachweis behandeln.

### 18. supportsTablet:true ohne iPad-Optimierung: iPad-Screenshots liefern oder auf false setzen
- **Bereich:** apple-guidelines
- **Stelle:** `app/app.json:45`
- **Problem:** ios.supportsTablet ist true. Damit erwartet ASC iPad-Screenshots und Apple prueft das iPad-Layout. Die App ist portrait und Phone-Layout-orientiert; ein unoptimiertes iPad-Erscheinungsbild kann nach 4.0 bemaengelt werden, fehlende iPad-Screenshots blockieren die Submission. Fuer TestFlight ok. APP-STORE-CHECKLIST.md:46 listet die Entscheidung als offen.
- **Loesung:** Entweder iPad-Screenshots plus akzeptables iPad-Layout liefern, oder in app.json supportsTablet auf false setzen (iPhone-only), um den iPad-Pruefpfad zu vermeiden.

### 19. LIGHT primary/success #0B8A5E verfehlt WCAG AA (4,5:1) fuer kleinen Text knapp
- **Bereich:** ux-a11y
- **Stelle:** `app/contexts/ThemeContext.tsx:35-37`
- **Problem:** Heute wurde primary/success von #0E9F6E (3,19:1 auf Karte) auf #0B8A5E gedunkelt - echte Verbesserung, aber noch zu hell fuer normalen Text. Nachgerechnet (WCAG relative Luminanz): #0B8A5E auf der effektiven Kartenflaeche (rgba(255,255,255,0.52) ueber bg #EEF1F6 = ~#F7F8FB, mit GlassFill-Toenung ~#FAFAFC) = 4,11-4,19:1; auf reinem Weiss 4,36:1; auf Screen-bg #EEF1F6 nur 3,86:1. AA verlangt 4,5:1 fuer Text <18,66px regular bzw. <14px bold; die 3:1-Ausnahme gilt nur fuer >=14px BOLD. Gruener Kleintext unter 4,5:1 ist breit im Einsatz: Paywall price 15px/700 (Paywall.tsx:169) und link 13px/600 (181), AuthScreen forgot 13px/600 (267) sowie acceptLink/switchLink (278/285), HomeScreen bonusLine 12px/700 (373), FoodTracker quickMsg 13px/600 success (1050) und bonusLine 12px (1065), diverse back-Links 15px/600. Im DUNKEL-Theme ist derselbe Text konform (primary #16B486 = 6,44:1) - das Problem ist rein hell.
- **Loesung:** primary UND success im LIGHT-Satz weiter abdunkeln, z. B. #0A8159 (4,60:1 auf Karte, knapp) oder sicherer #097A52 (5,05:1) bzw. #08744D (5,47:1). Buttons (gruen mit weisser onPrimary-Schrift) bleiben dabei unproblematisch. accent #0E9F6E (nur Dot/Highlight, kein Text) kann bleiben.

### 20. Keinerlei Analytics/Funnel-Tracking - Conversion und Retention sind blind nicht messbar
- **Bereich:** business-ceo
- **Stelle:** `build/content.json:479-486`
- **Problem:** Es existiert kein Analytics-/Event-Tracking im Client (keine Amplitude/PostHog/Firebase-Integration; auch RevenueCat liefert nur Kauf-Events, nicht Funnel-Schritte). Der Business-Plan definiert dagegen klare KPIs (content.json:483-486: Aktivierungsrate, D1/D7/D30-Retention, Free->Premium-Conversion, K-Faktor) und content.json:9 nennt hohe 30-Tage-Abbruchquoten als zentrales Problem. Ohne mindestens Onboarding-Abschluss-, Paywall-Impression- und Kauf-Events lassen sich weder die Conversion-Annahmen validieren noch Paywall/Onboarding optimieren - genau das, wofuer eine Beta/TestFlight-Phase da ist.
- **Loesung:** Vor/zur Beta ein schlankes, DSGVO-konformes Event-Tracking ergaenzen (z. B. PostHog EU-Hosting oder Firebase): Events fuer onboarding_completed, paywall_shown(feature), purchase_started/succeeded/cancelled, restore. Einwilligung sauber trennen (content.json:368 sieht separate Analytics-Einwilligung vor). Kein TestFlight-Blocker, aber sonst fliegt die Beta blind.

### 21. parse-meal nutzt output_config/json_schema (Structured Outputs) - bei Anthropic-API-Inkompatibilitaet bricht JEDE KI-Analyse (502), nicht nur Edge-Case
- **Bereich:** critic
- **Stelle:** `supabase/functions/parse-meal/index.ts:121-136`
- **Problem:** Der Request an api.anthropic.com (Z.124-130) setzt 'output_config: { format: { type: "json_schema", schema: SCHEMA } }' mit model 'claude-haiku-4-5'. Falls dieses Feld/Format von der eingesetzten Anthropic-API-Version (anthropic-version 2023-06-01, Z.123) nicht akzeptiert wird, liefert die API einen Nicht-200 -> die Function gibt pauschal 502 'ai_error' (Z.135) zurueck und KEINE Mahlzeit wird je erkannt. Das ist kein heutiger Fix, aber ein latenter Totalausfall der bezahlten Kern-KI-Funktion, der erst beim echten Aufruf sichtbar wird (in Expo Go/lokal evtl. nie getestet). Sollte vor TestFlight mit einem echten Aufruf verifiziert werden, da die KI ein beworbenes Premium-Feature ist.
- **Loesung:** Einen echten End-to-End-Aufruf gegen die deployte v4-Function machen und die Anthropic-Antwort/Logs pruefen. Falls output_config nicht unterstuetzt wird, auf das dokumentierte Tools/tool_choice- oder messages-JSON-Format der aktuellen API-Version umstellen.


## KLEIN

### 22. isPremium-Kommentar/Profilfeld noch als '(Test-)Schalter' bezeichnet, obwohl Test-Schalter heute entfernt wurde
- **Bereich:** regression-screens-food-home
- **Stelle:** `app/contexts/AuthContext.tsx:138-139`
- **Problem:** Verifikation, keine Funktionsstoerung: isPremium = rcPremium || !!profile.is_premium ist korrekt verdrahtet (RevenueCat-Listener L109-111 + login L112-114). Der Kommentar L138 'oder der (Test-)Schalter im Profil an ist' ist nach Entfernen des SettingsScreen-Schalters und Migration 034 (Client darf is_premium nicht mehr setzen) irrefuehrend: profile.is_premium kann jetzt nur noch serverseitig (Webhook/Admin) gesetzt werden. Rein kosmetisch.
- **Loesung:** Kommentar aktualisieren, z. B. 'oder das serverseitig gesetzte profiles.is_premium true ist (RevenueCat-Webhook / Admin)'.

### 23. applyNlItems: Fehler nur bei tatsaechlichem food_logs-INSERT sichtbar, vorgelagerte foods-Inserts schlucken Fehler
- **Bereich:** regression-screens-food-home
- **Stelle:** `app/screens/FoodTrackerScreen.tsx:325-359`
- **Problem:** Beim Eintragen KI-erkannter Items werden pro Item ggf. neue foods angelegt (L338-347). Schlaegt das Anlegen UND das Re-Select fehl, wird das Item ohne Hinweis stillschweigend uebersprungen (foodId bleibt null, kein push). Nur wenn am Ende rows leer/Insert-Fehler ist, sieht der Nutzer etwas. In der Praxis selten (RLS erlaubt eigene foods), aber ein einzeln verschwundenes Item ohne Rueckmeldung ist verwirrend. Nicht heute geaendert.
- **Loesung:** Wenn am Ende weniger rows als nlItems entstanden sind, einen Hinweis setzen ('Einige Eintraege konnten nicht angelegt werden, bitte erneut versuchen.').

### 24. ProfileScreen: target_date eines alten lose_weight-Ziels bleibt beim Zielwechsel bestehen
- **Bereich:** regression-screens-train-settings
- **Stelle:** `app/screens/ProfileScreen.tsx:140-158`
- **Problem:** Das neue In-Place-Update schreibt nur goal_type, target_weight_kg und is_active in goalRow. Wechselt ein Nutzer im Profil von 'Abnehmen' auf z.B. 'Muskelaufbau', wird target_weight_kg korrekt auf null gesetzt, aber ein evtl. im Onboarding gesetztes target_date (vgl. OnboardingScreen.tsx:130/133) bleibt in der bestehenden goals-Zeile erhalten. Konsequenz: Es kann ein Zieldatum ohne Zielgewicht zurueckbleiben. Reiner Datenhygiene-Punkt, kein Crash/Funktionsfehler.
- **Loesung:** In goalRow zusaetzlich target_date setzen: goal === 'lose_weight' ? <Datum> : null, damit das Zieldatum konsistent zum Zieltyp ist.

### 25. Webhook akzeptiert Authorization-Header nur exakt gleich dem Secret (kein Bearer-Prefix) - korrekt, aber fragil bei Fehlkonfiguration
- **Bereich:** new-purchases-context-app
- **Stelle:** `supabase/functions/revenuecat-webhook/index.ts:31-33`
- **Problem:** auth !== secret vergleicht den Authorization-Header 1:1 mit REVENUECAT_WEBHOOK_SECRET. Das ist korrekt: RevenueCat sendet den im Dashboard eingetragenen Authorization-Wert VERBATIM (kein automatisches 'Bearer '-Prefix). Body-Parsing (body.event.type, event.app_user_id) entspricht dem tatsaechlichen RevenueCat-Format { event: { type, app_user_id, ... } } - verifiziert korrekt, inkl. der ACTIVE/INACTIVE-Event-Mengen (INITIAL_PURCHASE/RENEWAL/... aktiv; EXPIRATION/SUBSCRIPTION_PAUSED inaktiv; CANCELLATION/BILLING_ISSUE bewusst ignoriert -> richtig, da bis Ablauf weiter Premium). Risiko nur: Wenn Samuel im Dashboard versehentlich 'Bearer <secret>' eintraegt, das Secret aber ohne Prefix als REVENUECAT_WEBHOOK_SECRET speichert (oder umgekehrt), schlagen ALLE Webhooks mit 401 fehl und Premium wird nie gesetzt/entzogen - ohne sichtbaren Fehler in der App.
- **Loesung:** Beim Einrichten darauf achten, dass der Authorization-Wert im RevenueCat-Dashboard EXAKT gleich REVENUECAT_WEBHOOK_SECRET ist (gleicher String, gleiches/kein Prefix). Nach Einrichtung einen Test-Event senden und die Function-Logs auf 200 statt 401 pruefen.

### 26. parse-meal Premium-Gate ist fail-open bei fehlendem Profil-Datensatz (nicht nur bei Lesefehler)
- **Bereich:** new-purchases-context-app
- **Stelle:** `supabase/functions/parse-meal/index.ts:74-82`
- **Problem:** Das Gate prueft 'if (prof && prof.is_premium !== true) return 403'. Wenn das Profil NICHT gelesen werden kann (prof === null/undefined) - z. B. weil der Datensatz fehlt oder maybeSingle() nichts liefert - wird NICHT geblockt (fail-open), KI laeuft durch. Das ist laut Auftrag bewusst so ('fail-open bei Lesefehler'), aber der Kommentar beschreibt nur den Lese-EXCEPTION-Pfad; tatsaechlich ist auch der 'Zeile existiert nicht'-Fall fail-open. Da der Reader mit Service-Role liest (admin, ohne RLS) und jeder eingeloggte Nutzer beim Onboarding eine profiles-Zeile bekommt, ist der praktische Missbrauchsspielraum gering; zusaetzlich greift das Tageslimit (DAILY_LIMIT=60) und der Client gated ohnehin (FoodTrackerScreen.tsx:281). Kein Blocker, aber bewusst so akzeptieren.
- **Loesung:** Akzeptabel fuer TestFlight. Optional haerten: bei prof == null defensiv 403 statt fail-open zurueckgeben (da mit Service-Role gelesen wird, ist ein null-Profil ein echter Sonderfall, kein transienter Lesefehler). Den Kommentar entsprechend praezisieren.

### 27. Migration 034 schuetzt nur UPDATE, nicht INSERT von is_premium durch den Client
- **Bereich:** new-purchases-context-app
- **Stelle:** `app/db/034_protect_is_premium.sql:29-32`
- **Problem:** Der Trigger trg_protect_is_premium ist 'before update' - er verhindert nur das AENDERN von is_premium durch authenticated/anon (verifiziert korrekt fuer UPDATE). Beim INSERT greift er nicht. Ob ein Client beim Anlegen seiner eigenen profiles-Zeile is_premium=true setzen kann, haengt davon ab, ob (a) ein INSERT durch den Client ueberhaupt per RLS erlaubt ist und (b) ob die Zeile durch einen Auth-Trigger (handle_new_user) serverseitig erzeugt wird. Konnte ich nicht abschliessend pruefen, da die RLS-Policies/der handle_new_user-Trigger nicht in den heute geaenderten Dateien liegen. Wenn das Profil ausschliesslich serverseitig per SECURITY DEFINER-Trigger angelegt wird, ist alles dicht; erlaubt eine INSERT-Policy dem Client das Anlegen mit beliebigen Spaltenwerten, koennte er sich beim ERSTEN Insert Premium geben.
- **Loesung:** Verifizieren (in einer der frueheren Migrationen / schema.sql), dass es KEINE INSERT-Policy auf public.profiles fuer authenticated/anon gibt, die beliebige Spalten zulaesst - oder den Trigger auf 'before insert or update' erweitern und bei INSERT durch authenticated/anon is_premium auf false/Default zwingen.

### 28. parse-meal: Premium-Gate ignoriert Lesefehler der Query (catch ist fuer .maybeSingle()-Fehler quasi tot) — Fail-open korrekt, aber nicht wie kommentiert
- **Bereich:** edge-functions
- **Stelle:** `supabase/functions/parse-meal/index.ts:74-82`
- **Problem:** Das Gate liest 'const { data: prof } = await reader.from("profiles").select("is_premium")...maybeSingle()' und wertet 'error' NICHT aus. supabase-js wirft bei Query-Fehlern nicht, sondern liefert { data:null, error }. Damit fuehrt JEDER Lesefehler (RLS, Spalte fehlt, DB-Timeout) zu prof=undefined -> Bedingung 'prof && prof.is_premium !== true' ist false -> Aufruf laeuft durch (fail-open). Das ENTSPRICHT der gewollten 'fail-open bei Lesefehler'-Semantik, ABER der try/catch drumherum (Zeile 80-82) faengt praktisch nur echte Exceptions/Netzwerkfehler — die kommentierte 'fail-open bei reinem Lesefehler' laeuft de facto ueber den ignorierten error, nicht ueber den catch. Sicherheitlich unkritisch (Tageslimit + Client-Gate bremsen), nur die Logik weicht leicht vom Kommentar ab; ein boeswilliger Client kann daraus keinen verlaesslichen Bypass bauen, weil mit gueltigem Service-Role-Reader die Zeile normalerweise lesbar ist und dann 403 greift.
- **Loesung:** Optional 'error' der Query mitlesen und nur bei tatsaechlichem error bewusst fail-open gehen (loggen). Funktional kein Muss vor TestFlight.

### 29. parse-meal/FoodTracker: 403 'premium_required' wird nur als generische Stoerung angezeigt (kein Paywall-Hinweis)
- **Bereich:** edge-functions
- **Stelle:** `app/lib/parseMeal.ts:43-47`
- **Problem:** parseMeal.ts behandelt nur body.error === 'rate_limited' typisiert; eine 403-Antwort 'premium_required' faellt in 'throw error'. In FoodTrackerScreen.tsx:305-308 wird daraus 'Erkennung gerade nicht verfuegbar. Bitte spaeter erneut versuchen.' — also weder ein haesslicher Roh-Fehler (gut) noch ein zutreffender Premium-Hinweis. Praktisch ist dieser Pfad fast unerreichbar, weil recognizeMeal() in FoodTrackerScreen.tsx:281 schon vorab 'if (!isPremium) { openPaywall("ki"); return; }' macht; der 403 traefe nur die Randlage rcPremium=true & profiles.is_premium=false (z. B. Webhook noch nicht durch). Daher niedrige Prioritaet.
- **Loesung:** Optional in parseMeal.ts body.error === 'premium_required' als ParseMealError('premium_required', ...) werfen und in FoodTracker openPaywall('ki') ausloesen. Kein TestFlight-Blocker.

### 30. delete-account: gibt rohe Fehlermeldung (String(e) / dErr.message) an den Client zurueck
- **Bereich:** edge-functions
- **Stelle:** `supabase/functions/delete-account/index.ts:30-36`
- **Problem:** Bei Fehlern liefert die Function 'error: dErr.message' bzw. 'error: String(e)' im JSON-Body. Das kann interne Details (Supabase-/Auth-Fehlertexte) preisgeben. Konsument app/lib/gdpr.ts:54 wertet aber nur 'if (!error)' aus und zeigt den Text NICHT an (faellt bei Misserfolg auf clientseitige Loeschung zurueck). Damit ist es kein UX-Leck; das Detail landet nur in Netzwerk-/Logansicht. Nicht heute geaendert. CORS ist '*', was fuer diese tokengeschuetzte Function vertretbar ist.
- **Loesung:** Optional generische Meldung ('Konto-Loeschung fehlgeschlagen') zurueckgeben und Details nur serverseitig loggen. Niedrige Prioritaet.

### 31. exercisedb-image: offener GET-Proxy haengt allein an verify_jwt; Anon-Key als Bearer ist dauerhaft gueltiges 'JWT' -> jeder mit dem oeffentlichen Anon-Key kann den bezahlten RapidAPI-Key indirekt nutzen
- **Bereich:** edge-functions
- **Stelle:** `supabase/functions/exercisedb-image/index.ts:22-42`
- **Problem:** Der Proxy validiert nur Eingaben (exerciseId-Regex, resolution-Allowlist) und verlaesst sich auf das Supabase-Gateway-verify_jwt. Der Client schickt laut ExerciseGif.tsx:23-31 entweder den eingeloggten Access-Token ODER faellt auf den ANON-Key als Bearer zurueck. Der Anon-Key ist im App-Bundle (EXPO_PUBLIC_*) und damit oeffentlich; er ist ein gueltiges 'JWT' fuers Gateway. Folge: Jeder, der den Anon-Key kennt, kann den Proxy beliebig oft aufrufen und so den bezahlten ExerciseDB/RapidAPI-Key (Kosten) anzapfen — ohne eigenes Nutzerkonto. Es gibt KEIN per-Nutzer-Rate-Limit wie bei parse-meal. Der Code mildert das bewusst nur ueber das empfohlene RapidAPI-Spend-Limit (Kommentar Zeile 10) und Edge-/Client-Cache. Nicht heute geaendert; fuer TestFlight vertretbar, aber als Kostenrisiko notieren.
- **Loesung:** Vor PUBLIC-Release: RapidAPI-Spend-Limit zwingend setzen (Kostenschutz). Optional Proxy haerten (z. B. nur eingeloggte User: getUser() pruefen statt Anon-Key zuzulassen, oder ein leichtes Rate-Limit/Cache-only). Kein TestFlight-Blocker.

### 32. 033_premium.sql-Kommentar widerspricht der jetzigen Architektur
- **Bereich:** db-rls-premium
- **Stelle:** `app/db/033_premium.sql:6-9`
- **Problem:** Kommentar sagt noch, der Nutzer duerfe is_premium per Schalter in den Einstellungen umstellen (Update-Policy erlaube das). Nach dem Batch falsch: Schalter weg, 034 blockt Client-UPDATE. Irrefuehrende SQL-Doku, kein funktionaler Fehler.
- **Loesung:** Kommentar aktualisieren: is_premium nur serverseitig (Webhook/service_role), Verweis auf 034.

### 33. prevent_is_premium_change ohne festes search_path
- **Bereich:** db-rls-premium
- **Stelle:** `app/db/034_protect_is_premium.sql:14-26`
- **Problem:** Funktion ist SECURITY INVOKER (prosecdef=false live), nutzt keine unqualifizierten Objekte, daher aktuell unkritisch und current_user-Check korrekt. Anders als handle_new_user/_leaderboard_recompute fehlt set search_path=public. Relevant erst bei spaeteren Tabellenzugriffen. Kein Blocker.
- **Loesung:** Optional set search_path=public anhaengen, konsistent mit den anderen SECURITY-Funktionen.

### 34. Sicherheitsstand verifiziert und offene low-Punkte
- **Bereich:** security
- **Stelle:** `app/db/schema.sql:223-230 und revenuecat-webhook index.ts:31-33`
- **Problem:** Verifiziert live: is_premium faelschungssicher durch Trigger trg_protect_is_premium gleich Migration 034 und kein Client-Write mehr (togglePremium entfernt, nur READ in AuthContext.tsx 24 43 139). parse-meal deployt v4 verify_jwt true mit 403-Premium-Gate plus Tageslimit. Leaderboard serverseitig per Trigger 024. iOS-Secrets unkritisch (nur EXPO_PUBLIC, service_role serverseitig). secureStorage Kopf-zuletzt korrekt. Offen low: schema.sql enthaelt die Schutz-Trigger aus 034 und 024 nicht (Neuaufbau unsicher, Prod hat sie live), der Webhook-Secret-Vergleich ist nicht konstantzeit und ein Kauf vor Login trifft null Zeilen (fail-safe), und die Premium-Gates fuer Scanner Uebungen Plaene und Level sind nur UI-seitig, aber ohne Serverkosten und Datenabfluss.
- **Loesung:** Trigger aus 024 027 und 034 in schema.sql aufnehmen, vor TestFlight die Webhook-Secrets und den Authorization-Wert in RevenueCat setzen, und werthaltige Gates fuer den Public-Release serverseitig ziehen.

### 35. test_-RevenueCat-Key: kein Crash, aber Paywall zeigt in TestFlight evtl. 'Noch nicht verfuegbar' statt echtem Preis
- **Bereich:** ios-testflight
- **Stelle:** `app/lib/purchases.ts:12-17 + app/.env (EXPO_PUBLIC_REVENUECAT_KEY=test_...)`
- **Problem:** In .env ist NUR EXPO_PUBLIC_REVENUECAT_KEY (test_-Prefix) gesetzt; EXPO_PUBLIC_REVENUECAT_IOS_KEY/ANDROID_KEY fehlen, also faellt RC_KEY auf iOS auf den test_-Key zurueck (purchases.ts:16). Das ist bewusst und fuer TestFlight ok und crasht NICHT: react-native-purchases 10.2.2 buendelt eine native Version weit ueber der fuer den Test Store noetigen 5.43.0; configure() laeuft zudem in try/catch (purchases.ts:31-38). Konsequenz fuer den Tester: Mit test_-Key zieht das SDK Test-Store-Produkte statt echter StoreKit-/App-Store-Connect-Produkte. Enthaelt das aktuelle Offering kein Test-Store-Monatspaket, liefert getPremiumPackage() null und purchasePremium() gibt 'unavailable' -> Paywall zeigt 'Noch nicht verfuegbar' (Paywall.tsx:67-71). Ein echter Sandbox-IAP-Test in TestFlight braucht den appl_-Key + im App Store Connect angelegtes Abo.
- **Loesung:** Fuer reinen App-Start/Crash-Test nichts noetig. Soll der Kauf bereits in TestFlight (Sandbox) getestet werden: appl_-Key als EXPO_PUBLIC_REVENUECAT_IOS_KEY in den EAS-Build-Secrets setzen und im RevenueCat-Dashboard ein Offering mit Monatspaket konfigurieren. Sonst bewusst beim test_-Key bleiben und 'unavailable' als erwartetes Verhalten einplanen.

### 36. Veralteter Kommentar in AuthContext verweist noch auf den entfernten '(Test-)Schalter im Profil'
- **Bereich:** ios-testflight
- **Stelle:** `app/contexts/AuthContext.tsx:138`
- **Problem:** Kommentar lautet: 'Premium ist aktiv, wenn RevenueCat einen Kauf meldet ODER der (Test-)Schalter im Profil an ist.' Der Premium-(Test)-Schalter wurde heute aus SettingsScreen entfernt und der Client darf is_premium per Trigger trg_protect_is_premium (Migration 034) nicht mehr setzen. Die Logik 'isPremium = rcPremium || !!profile?.is_premium' (Zeile 139) ist KORREKT und gewollt (is_premium wird serverseitig vom revenuecat-webhook gesetzt) - kein Funktionsfehler, nur ein irrefuehrender Kommentar. Reine Doku-Altlast, keine iOS-/Build-Auswirkung.
- **Loesung:** Kommentar Zeile 138 anpassen, z. B. '... ODER das Profil serverseitig (RevenueCat-Webhook) is_premium=true gesetzt hat.' Optional, nicht release-blockierend.

### 37. AVV-Aussage 'werden geschlossen' im Datenschutz, obwohl AVVs laut Projektstand noch offen sind
- **Bereich:** legal-de
- **Stelle:** `app/lib/legal.ts:93`
- **Problem:** Die Datenschutzerklaerung behauptet als Tatsache: 'Mit diesen Auftragsverarbeitern werden Auftragsverarbeitungsvertraege (AVV) gemaess Art. 28 DSGVO geschlossen' (legal.ts:93 fuer Supabase/Anthropic; legal.ts:101 fuer RevenueCat: 'ein Auftragsverarbeitungsvertrag ... wird geschlossen'). Laut MEMORY/Projektstand ist der AVV mit RevenueCat noch offen. Die Formulierung 'werden geschlossen' (Futur/Absicht) ist gerade noch vertretbar, suggeriert aber faktisch bestehende Vertraege. Solange tatsaechlich kein AVV mit einem genannten Verarbeiter besteht, ist die Aussage potenziell irrefuehrend (Art. 28 verlangt den abgeschlossenen Vertrag als Voraussetzung der Verarbeitung). Kein TestFlight-Blocker (interner Test), aber vor PUBLIC-Release abzusichern.
- **Loesung:** Vor oeffentlichem Release sicherstellen, dass mit Supabase, Anthropic und RevenueCat tatsaechlich AVVs/DPAs bestehen (bei allen drei i.d.R. ueber Standard-DPA verfuegbar), und die Formulierung erst dann auf den Ist-Zustand ('bestehen'/'wurden geschlossen') umstellen.

### 38. KI-Einwilligungs-Widerruf nur best-effort und ohne Server-Rueckmeldung
- **Bereich:** legal-de
- **Stelle:** `app/screens/SettingsScreen.tsx:161-166`
- **Problem:** revokeAiConsent() entfernt AsyncStorage('fitavo.aiConsentAt') und setzt profiles.ai_consent_at=null als reines Fire-and-forget ('.then(() => {}, () => {})', kein await, kein Fehlerhandling). Schlaegt das Server-Update fehl (Offline/RLS/Migration 026 fehlt), meldet die anschliessende Alert ('Erledigt') dem Nutzer trotzdem Erfolg, obwohl der serverseitige Einwilligungsstempel ai_consent_at bestehen bleibt. Fuer den Widerruf einer Art.9-Einwilligung (Art. 7 Abs. 3 DSGVO) ist das unsauber, weil dokumentierter Server-Stand und Nutzer-Rueckmeldung auseinanderlaufen koennen. Die clientlokale Logik (FoodTrackerScreen.tsx:104/116 liest nur AsyncStorage) wirkt lokal korrekt; das Risiko liegt rein im serverseitigen Nachweis.
- **Loesung:** Server-Update awaiten und das Ergebnis in die Bestaetigung einfliessen lassen (bei Fehler Hinweis 'lokal widerrufen, Server folgt beim naechsten Login').

### 39. LIGHT danger #D33C41 als Fehlertext knapp unter AA
- **Bereich:** ux-a11y
- **Stelle:** `app/contexts/ThemeContext.tsx:37`
- **Problem:** danger wurde heute von #E5484D (3,69:1) auf #D33C41 verbessert, liegt aber bei 4,40:1 auf Karte und 4,13:1 auf Screen-bg - knapp unter 4,5:1. Betroffen sind kleine, wichtige Fehlertexte: FoodTracker nlHint 12px (FoodTrackerScreen.tsx:1106) und error 14px (1130), Onboarding error 14px (OnboardingScreen.tsx:220), HomeScreen/PlanScreen/ExerciseDetail error 14px, AuthScreen infoBox-Fehlertext 14px. Fehlermeldungen sind gerade die Texte, die gut lesbar sein muessen. Dunkel-Theme (danger #FF6B6B = 6,16:1) ist konform.
- **Loesung:** danger im LIGHT-Satz minimal dunkler, z. B. #C7353A oder #BE3035, um auch auf Screen-bg ueber 4,5:1 zu kommen. Optional Fehlertexte auf >=14px bold setzen (dann greift 3:1).

### 40. Deutsche Anfuehrungszeichen falsch gepaart (oeffnend U+201E, schliessend ASCII Doublequote)
- **Bereich:** ux-a11y
- **Stelle:** `app/components/Paywall.tsx:18`
- **Problem:** In der KI-Benefit-Zeile wird mit dem deutschen unteren Zitat U+201E geoeffnet, aber mit geradem ASCII-Doppelquote U+0022 geschlossen statt mit korrektem oberen U+201C. Rendert sichtbar inkonsistent. Dasselbe Muster (U+201E + U+0022) auch in FoodTrackerScreen.tsx:694, :735, :776 (z. B. Tippe-Zutat-hinzufuegen-Hinweis). Reiner Typografie-/Copy-Fehler, keine Funktionsstoerung. Der Apostroph in Sprich-s ist U+2019 und korrekt.
- **Loesung:** Schliessendes Zeichen jeweils auf U+201C aendern, also korrekt deutsch geschlossene Klammer.

### 41. Paywall-Pflichtlinks und Kaeufe-wiederherstellen als sehr kleine Touch-Targets
- **Bereich:** ux-a11y
- **Stelle:** `app/components/Paywall.tsx:143-150`
- **Problem:** Kaeufe wiederherstellen (Zeile 144) und die Rechtslinks Nutzungsbedingungen/Datenschutz (147-149) sind blanke Text-onPress-Elemente mit fontSize 13 in linksRow (nur marginTop:8, kein padding/hitSlop). Effektive Trefferflaeche ~17px hoch - deutlich unter Apples 44x44pt-Empfehlung. Kaeufe wiederherstellen ist von Apple fuer Abo-Apps vorgeschriebene Funktion und sollte komfortabel tippbar sein. Funktional vorhanden (kein Submission-Blocker), aber a11y-/UX-Luecke; zudem keine accessibilityRole button auf diesen Text-Links.
- **Loesung:** Diese Text-Links in TouchableOpacity mit paddingVertical>=10 (oder hitSlop) und accessibilityRole button kapseln, damit die Trefferflaeche ~44pt erreicht.

### 42. HomeScreen levelPill als interaktives Element zu niedrig (Touch-Target)
- **Bereich:** ux-a11y
- **Stelle:** `app/screens/HomeScreen.tsx:215`
- **Problem:** Der levelPill ist fuer Nicht-Premium-Nutzer interaktiv (oeffnet die Paywall, accessibilityLabel korrekt: Premium freischalten um zu leveln), hat aber nur paddingVertical:7 bei 13px-Text, also ca. 27px Hoehe und keinen hitSlop (Style levelPill Zeile 365). Unter 44pt. Fuer Premium ist er disabled (reine Statusanzeige) - dann unkritisch. Logik und a11y-Labels sind ansonsten korrekt umgesetzt.
- **Loesung:** Im Nicht-Premium-Fall hitSlop ergaenzen oder paddingVertical erhoehen, damit die Trefferflaeche ~44pt erreicht.

### 43. scheme "fitavo" korrekt ergaenzt (heutiger Fix bestaetigt)
- **Bereich:** config-build-hygiene
- **Stelle:** `app/app.json:6`
- **Problem:** Commit db3f1ac fuegt "scheme": "fitavo" hinzu (per git show verifiziert). Das ist fuer ein Standalone-Build/Deep-Links/RevenueCat-Redirects sinnvoll und matcht den Markennamen. Korrekt umgesetzt, keine Regression.
- **Loesung:** Keine Aenderung noetig. Bestaetigt.

### 44. LICENSE + AGENTS.md heute korrekt aktualisiert (bestaetigt)
- **Bereich:** config-build-hygiene
- **Stelle:** `app/LICENSE:1-13, app/AGENTS.md:1-9`
- **Problem:** LICENSE ist jetzt eine proprietaere All-rights-reserved-Lizenz (Samuel Sinemli, Kontakt Info@fitavo.eu) statt MIT/Default. AGENTS.md verweist auf Expo SDK 54 (RN 0.81, React 19) mit ausdruecklichem Hinweis NICHT zu upgraden, plus Doku-Link v54. Commit db3f1ac aendert beide Dateien. Korrekt.
- **Loesung:** Keine Aenderung noetig. Bestaetigt.

### 45. production-Build-Profil ist TestFlight-tauglich (autoIncrement, kein iOS-Override)
- **Bereich:** config-build-hygiene
- **Stelle:** `app/eas.json:16-19, 1-5`
- **Problem:** production hat autoIncrement:true und cli.appVersionSource:remote -> die iOS-Build-Nummer wird auf EAS-Servern automatisch hochgezaehlt (kein hartkodiertes buildNumber/versionCode in app.json gefunden, per grep verifiziert). Unter production gibt es keinen ios-Block, daher greift der Default distribution:store mit IPA-Archiv -> genau richtig fuer TestFlight. Android-Teil ist app-bundle (korrekt fuer Play). submit.production ist {} (EAS fragt ASC-Key/Apple-ID beim Submit ab) - ok.
- **Loesung:** Keine Aenderung noetig. Hinweis: Beim ersten `eas submit -p ios` App-Store-Connect-API-Key/Apple-ID bereithalten.

### 46. react-native-purchases 10.2.2 ist mit RN 0.81 / SDK 54 kompatibel
- **Bereich:** config-build-hygiene
- **Stelle:** `app/package.json:28`
- **Problem:** Installierte Version laut node_modules/react-native-purchases/package.json = 10.2.2, peerDependency react-native >= 0.73.0. RN 0.81.5 erfuellt das. Modul-Level-Import in lib/purchases.ts:10 (import Purchases ...) ist auf einem echten EAS-Build unkritisch, da der Pod vorhanden ist; configure/login sind defensiv in try/catch gekapselt (purchases.ts:31-38,49-55). Keine API-Inkompatibilitaet erkennbar.
- **Loesung:** Keine Aenderung noetig. (Nur fuer Web/Expo Go wuerde der statische Import fehlschlagen - kein TestFlight-Thema.)

### 47. Native Module brechen den iOS-Build nicht (health-connect Android-only, korrekt isoliert)
- **Bereich:** config-build-hygiene
- **Stelle:** `app/lib/health.ts:9-22, app/plugins/withHealthConnect.js:36-37, app/app.json:19,28`
- **Problem:** react-native-health-connect hat KEINE iOS-Podspec (verifiziert: kein *.podspec im Paket) und wird in health.ts nur via lazy require() hinter Platform.OS==='android' geladen -> auf iOS niemals importiert, kein Crash. Beide Plugins sind Android-spezifisch: das Paket-app.plugin.js nutzt withAndroidManifest, withHealthConnect.js nutzt withAndroidManifest/withMainActivity und steigt bei Nicht-Kotlin sofort aus (Zeile 37). Auf iOS-Prebuild passiert dort nichts. Sauber.
- **Loesung:** Keine Aenderung noetig. Bestaetigt build-sicher fuer iOS.

### 48. Alte FitFusion-Dateien im Repo-Root getrackt (Hygiene, nicht user-sichtbar)
- **Bereich:** config-build-hygiene
- **Stelle:** `FitFusion-Masterfile.docx (root), build/Start-FitFusion.cmd, build/Start-FitFusion-Web.cmd`
- **Problem:** git ls-files zeigt FitFusion-Masterfile.docx (30 KB Businessplan-Binary) sowie zwei Start-FitFusion*.cmd am Repo-Root als getrackt. grep -i fitfusion ueber app/ liefert NULL Treffer -> nichts davon landet im App-Bundle oder ist im Store sichtbar. Reine Repo-Hygiene/Professionalitaet (alter Markenname, Binary im Code-Repo). Bereits in PRE-APPLE-AUDIT.md als known-open dokumentiert.
- **Loesung:** Optional: .docx aus dem Code-Repo entfernen/gitignoren (nur content.json behalten) und Start-Skripte zu Start-FitAvo*.cmd umbenennen (git mv). Kein App- oder Submission-Effekt.

### 49. Expo slug ist generisch "app"
- **Bereich:** config-build-hygiene
- **Stelle:** `app/app.json:4`
- **Problem:** Der Expo-Projekt-slug ist "app" (nicht "fitavo"). Das ist nur EAS-/Expo-intern relevant (Projekt-URL/Build-Listing) und kollidiert nicht mit bundleIdentifier com.samuelfb1907.fitavo oder dem App-Store-Namen FitAvo. Kein Funktions- oder Store-Problem; rein kosmetisch im EAS-Dashboard.
- **Loesung:** Optional bei naechster Gelegenheit: slug auf "fitavo" angleichen. Da projectId fest verknuepft ist, nicht ohne Not aendern - kein TestFlight-Thema.

### 50. Gebundeltes avocado.png/splash/icon relativ gross (Asset-Groesse)
- **Bereich:** config-build-hygiene
- **Stelle:** `app/assets/avocado.png (1.5 MB, 1024x1024), app/assets/icon.png (~653 KB), app/assets/splash-icon.png (~832 KB)`
- **Problem:** icon.png und splash-icon.png sind korrekt 1024x1024 (per file-Header verifiziert) - passt fuer Apple. avocado.png (1.499.529 Bytes) wird in screens/AuthScreen.tsx genutzt und voll ins JS-Bundle gepackt; alle drei sind als PNG fuer ihren Anzeigezweck (Splash 220px, Auth-Logo) ueberdimensioniert. Erhoeht nur App-Groesse/Startzeit minimal, kein Fehler.
- **Loesung:** Optional: avocado/splash auf die real benoetigte Aufloesung herunterskalieren bzw. PNG komprimieren (tinypng o.ae.). Nicht TestFlight-relevant.

### 51. Paywall ohne Conversion-Elemente (Social Proof, Ersparnis-Anker, Dringlichkeit)
- **Bereich:** business-ceo
- **Stelle:** `app/components/Paywall.tsx:108-155`
- **Problem:** Die Paywall ist sauber und ehrlich (Benefit-Liste, feature-spezifischer Hinweis, Fineprint, Restore, Rechtslinks - alles korrekt umgesetzt), enthaelt aber keine der ueblichen Conversion-Hebel: kein Preis-Anker/Vergleich (Monat vs. Jahr), kein Social Proof (Bewertungen/Nutzerzahl), keine Trial-Betonung. Bei nur einem Monatspreis ohne Ankerpreis wirkt 9,99 EUR teurer als noetig. Reine Optimierungsidee, kein Fehler.
- **Loesung:** Nach Einfuehrung von Jahresabo + Trial die Paywall mit Ersparnis-Badge am Jahresabo, optional kurzem Social-Proof-Element und klar hervorgehobenem 'Kostenlos testen' aufwerten. A/B-faehig halten, sobald Analytics steht.

### 52. PREMIUM_PRICE ist hartkodiert statt aus dem Store-Preis gelesen (lokalisierte Preise/Waehrungen)
- **Bereich:** business-ceo
- **Stelle:** `app/components/Paywall.tsx:15`
- **Problem:** PREMIUM_PRICE = '9,99 EUR / Monat' ist als String fest im Code. RevenueCat liefert ueber das Package den lokalisierten, store-korrekten Preis (pkg.product.priceString) inkl. Waehrung und laenderspezifischer Preise. Solange die App nur DACH/EUR bedient, ist das unkritisch und der Wert ist jetzt konsistent (siehe legal.ts:170). Bei spaeterer EU-/Auslandsexpansion (content.json:68) oder Apple-Preisanpassungen weicht der angezeigte Preis aber vom tatsaechlich abgerechneten ab - das beanstandet Apple potenziell und verwirrt Nutzer.
- **Loesung:** Mittelfristig den angezeigten Preis aus dem geladenen RevenueCat-Package (priceString) beziehen und PREMIUM_PRICE nur als Fallback nutzen. Fuer den ersten DACH-TestFlight-Build ist der Hardcode ok (bekannt/akzeptiert).

### 53. AuthContext: addPremiumListener wird VOR loginPurchases registriert -> erstes CustomerInfo-Event kann dem anonymen RevenueCat-User gehoeren
- **Bereich:** critic
- **Stelle:** `app/contexts/AuthContext.tsx:109-114`
- **Problem:** Im Effekt (Z.100-119) wird zuerst addPremiumListener(...) aufgerufen (Z.109) und erst danach loginPurchases(userId) (Z.112). Der CustomerInfoUpdateListener feuert bei Registrierung/Login. In der Praxis ist purchasePremium nur nach Login erreichbar, daher Folgen gering. Aber falls vor dem logIn() bereits Kundendaten (anonymer App-User aus configurePurchases()) eintreffen, setzt setRcPremium() einen Wert fuer die falsche Identitaet. Sauberer waere erst logIn, dann Listener bzw. den ersten Listener-Callback bis nach logIn zu ignorieren.
- **Loesung:** Reihenfolge umdrehen: loginPurchases(userId).then(...) zuerst auswerten, Listener danach registrieren; oder im Listener nur akzeptieren, wenn der RC-appUserID == userId.

### 54. App-Start plant iOS-Benachrichtigungen ohne je Permission angefragt zu haben (kein Crash, aber Erinnerungen bleiben still aus)
- **Bereich:** critic
- **Stelle:** `app/App.tsx:22-30 / app/lib/reminders.ts:42-75`
- **Problem:** Der Start-Effekt ruft applyReminders(prefs) wenn prefs.enabled. applyReminders ruft scheduleNotificationAsync auf, fordert aber NIE die Berechtigung an (ensurePermission() wird nur in den Einstellungen aufgerufen). Auf iOS planen scheduleNotificationAsync-Aufrufe ohne erteilte Berechtigung keine zustellbaren Benachrichtigungen (kein Crash, try/catch faengt zudem). Da prefs.enabled per Default false ist und nur ueber die Einstellungen (die ensurePermission aufrufen) aktiviert wird, ist der reale Schaden gering - aber falls enabled jemals true ohne erteilte iOS-Permission ist (z. B. Permission spaeter entzogen), feuern die Erinnerungen stillschweigend nicht. Verifiziert: kein Modulebene-Crash, setNotificationHandler (reminders.ts:14) laeuft beim Import - das ist auf iOS unkritisch.
- **Loesung:** Optional in applyReminders ein getPermissionsAsync()-Check und fruehes Return, damit der Zustand klar ist; oder beim Start nur nachplanen, wenn Permission granted.

### 55. react-native-purchases ist NICHT als Config-Plugin in app.json gelistet - Verifikation der iOS-Prebuild-Tauglichkeit
- **Bereich:** critic
- **Stelle:** `app/app.json:11-43 / app/package.json:28`
- **Problem:** react-native-purchases@10.2.2 ist installiert und wird auf Modulebene importiert (purchases.ts:10), aber in app.json/plugins NICHT aufgefuehrt. Verifiziert: react-native-purchases hat KEIN app.plugin.js/plugin-Verzeichnis (Pruefung der node_modules), d. h. es benoetigt KEIN Config-Plugin - die native Verlinkung laeuft via Expo-Autolinking beim Prebuild. Das ist korrekt und crasht den iOS-Build nicht. Dieser Befund dokumentiert nur, dass das Fehlen des Plugin-Eintrags ABSICHTLICH/korrekt ist (entgegen einer moeglichen Vermutung). KEIN Handlungsbedarf, ausser die Verifikation festzuhalten.
- **Loesung:** Keine Aenderung noetig. Beim ersten EAS-iOS-Build dennoch pruefen, dass 'pod install' react-native-purchases einzieht (Autolinking) und kein StoreKit-Config fehlt.

### 56. SettingsScreen: nach Entfernen des Premium-Schalters sind die Imports 'Switch' und 'supabase' verwaist (toter Code, kein Build-Fehler)
- **Bereich:** critic
- **Stelle:** `app/screens/SettingsScreen.tsx:3,6`
- **Problem:** Mit dem Entfernen von togglePremium (Diff db3f1ac) entfiel die einzige Verwendung von <Switch> und (vermutlich) supabase in diesem File. Die Imports stehen weiter in Z.3 (Switch) und Z.6 (supabase). tsconfig nutzt 'strict' aber NICHT noUnusedLocals (expo/tsconfig.base setzt es nicht), daher KEIN TypeScript-/Build-Fehler und KEIN Crash - reiner Lint/Hygiene-Punkt. (supabase koennte an anderer Stelle in der Datei noch genutzt werden; Switch ist nach dem Diff sehr wahrscheinlich ungenutzt.)
- **Loesung:** Ungenutzte Imports entfernen (Switch sicher; supabase nur, falls in der Datei nirgends sonst verwendet). Rein kosmetisch.

### 57. FoodTrackerScreen.applyFavorite/addUsual: nach erfolgreichem INSERT folgen loadLogs/loadQuick ungefangen (gleiche Klasse wie bereits gemeldete Mutations-Handler, hier zusaetzliche Fundstellen)
- **Bereich:** critic
- **Stelle:** `app/screens/FoodTrackerScreen.tsx:272-273,355,462`
- **Problem:** Die bereits gemeldete Regression (Mutations-Handler laden nach dem Schreiben ungefangen neu) betrifft konkret auch addUsual (Z.272-273: await loadLogs(); await loadQuick();), applyNlItems (Z.355: await loadLogs(); await loadQuick(); await loadUsual();) und applyFavorite (Z.462). Diese Loader werfen jetzt (loadLogs Z.197 'throw error' usw.). In addUsual/applyFavorite stehen sie im try, dessen finally nur busyRef zuruecksetzt - der Fehler wird als Unhandled Promise Rejection propagiert (kein catch, keine UI-Meldung). Ergaenzt die bekannte Fundstelle um die genauen Zeilen.
- **Loesung:** In allen Mutations-Handlern die abschliessenden Loader in ein try/catch packen (z. B. catch -> setError(errorMessage(e))) oder einen gemeinsamen reloadAll()-Helper mit eigenem catch verwenden.

### 58. revenuecat-webhook: PRODUCT_CHANGE/Downgrade auf Gratis-Produkt setzt faelschlich is_premium=true
- **Bereich:** critic
- **Stelle:** `supabase/functions/revenuecat-webhook/index.ts:18-20,43`
- **Problem:** PRODUCT_CHANGE ist in ACTIVE (Z.19) -> premium=true. RevenueCat sendet PRODUCT_CHANGE auch bei einem Wechsel auf ein NICHT-Premium-Produkt (Cross-/Downgrade). Da der Webhook nur den event.type auswertet und NICHT prueft, ob das resultierende Entitlement tatsaechlich 'premium' ist, koennte ein Downgrade Premium faelschlich aktiv lassen/setzen. Mit nur einem Premium-Produkt aktuell unkritisch, aber sobald (laut Business-Plan) Jahres-/weitere Produkte dazukommen, wird das falsch. Ergaenzt die bekannte EXPIRATION-Reihenfolge-Problematik um den PRODUCT_CHANGE-Fall.
- **Loesung:** Im Webhook den tatsaechlichen Entitlement-Status aus dem Event auswerten (event.entitlement_ids / entitlements enthaelt 'premium') statt nur den Event-Typ; oder PRODUCT_CHANGE neutral behandeln und sich auf RENEWAL/EXPIRATION verlassen.

### 59. OnboardingScreen.finish: target_date wird beim erstmaligen lose_weight-Ziel gesetzt, aber ProfileScreen-In-Place-Update setzt es nie -> Restwert-Inkonsistenz (Erweiterung des bekannten ProfileScreen-Befunds)
- **Bereich:** critic
- **Stelle:** `app/screens/OnboardingScreen.tsx:129-133 / app/screens/ProfileScreen.tsx (goalRow)`
- **Problem:** Onboarding setzt beim lose_weight-Ziel ein target_date (Z.130) und legt das Ziel an. Der heutige ProfileScreen-Fix updatet das aktive Ziel IN PLACE mit goalRow = { goal_type, target_weight_kg, is_active } - OHNE target_date. Wechselt der Nutzer im Profil das Ziel weg von lose_weight, bleibt das alte target_date in der Zeile (bekannt). Zusaetzlich: wechselt er ZURUECK zu lose_weight mit anderem Zeitrahmen, wird target_date nie aktualisiert (ProfileScreen kennt kein timeframe-Feld). Das alte/erste Datum aus dem Onboarding bleibt dauerhaft kleben. Ergaenzt den bekannten Befund um die Onboarding-Quelle des Werts.
- **Loesung:** In ProfileScreen goalRow.target_date explizit setzen (null wenn !lose_weight; sonst aus einem Zeitrahmen-Feld berechnen) oder dokumentieren, dass das Profil das target_date bewusst nicht pflegt und es separat zuruecksetzen.


## IDEE

### 60. RestTimer: Pause/Resume/Reset nach Wall-Clock-Umstellung korrekt (Verifikation)
- **Bereich:** regression-screens-train-settings
- **Stelle:** `app/components/RestTimer.tsx:24-35,66-67`
- **Problem:** Verifiziert, dass die heutige endRef/Wall-Clock-Umstellung Pause/Resume/Reset NICHT kaputtgemacht hat: start() und resume() setzen endRef neu (Date.now()+remaining*1000), pause() stoppt nur, reset() setzt remaining=duration -> paused-Flag wird dann false, Button zeigt 'Start'. tick() rechnet aus endRef, kein Drift, Cleanup via return clearTimer. Kein Bug.
- **Loesung:** Keine Aenderung noetig.

### 61. AuthContext-Kommentar erwaehnt noch '(Test-)Schalter im Profil'
- **Bereich:** regression-screens-train-settings
- **Stelle:** `app/contexts/AuthContext.tsx:138-139`
- **Problem:** Der Kommentar 'Premium ist aktiv, wenn RevenueCat einen Kauf meldet ODER der (Test-)Schalter im Profil an ist.' ist nach Entfernen des Settings-Schalters und mit Migration 034 (Client darf is_premium nicht mehr setzen) leicht irrefuehrend. Die Logik isPremium = rcPremium || profile.is_premium ist korrekt und gewollt (Testkonto serverseitig auf true).
- **Loesung:** Kommentar praezisieren, z.B. 'ODER profiles.is_premium serverseitig (RevenueCat-Webhook/Testkonto) gesetzt ist.' Reine Doku.

### 62. react-native-purchases Modulebene-Import crasht NICHT beim echten iOS-Build (verifiziert OK)
- **Bereich:** new-purchases-context-app
- **Stelle:** `app/lib/purchases.ts:9-10`
- **Problem:** Geprueft, da als kritischste Frage gestellt: 'import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesPackage } from "react-native-purchases"' auf Modulebene ist im echten iOS-Build UNKRITISCH. react-native-purchases ist ein Standard-RN-Autolinking-Modul (nativer iOS-Pod via PurchasesHybridCommon + Android-Modul); das JS-Objekt 'Purchases' und die Enums (LOG_LEVEL) sind nach dem Import vorhanden. Der einzige native Aufruf beim Start ist Purchases.configure() in configurePurchases() - und der steht in try/catch (Zeile 31-38). Anders als bei react-native-health-connect (das in health.ts bewusst lazy via require() geladen wird, weil es Android-only ist und in Expo Go fehlt) MUSS react-native-purchases hier NICHT lazy geladen werden, weil es auf beiden Plattformen im echten Build existiert. Wichtig: In Expo Go wuerde der Import zwar fehlschlagen, aber purchasesSupported/RC_KEY-Guards greifen erst danach - fuer den TestFlight-/EAS-Build (echtes Native-Bundle) ist das irrelevant. Kein app.json-Plugin noetig (react-native-purchases liefert kein Config-Plugin, Autolinking reicht). FAZIT: Kein Crash, kein Fix noetig.
- **Loesung:** Keine Aenderung noetig. Nur zur Sicherheit beim ersten EAS-Build verifizieren, dass 'npx expo prebuild' react-native-purchases im Podfile/settings.gradle auflistet (Standard-Autolinking - sollte automatisch passieren).

### 63. revenuecat-webhook: Secret-Vergleich nicht zeitkonstant (Timing-Seitenkanal)
- **Bereich:** edge-functions
- **Stelle:** `supabase/functions/revenuecat-webhook/index.ts:31-33`
- **Problem:** 'if (!secret || auth !== secret)' nutzt einen normalen String-Vergleich. Theoretisch ein Timing-Seitenkanal zum Erraten des Webhook-Secrets. Bei einem langen, zufaelligen Secret praktisch irrelevant; Vollstaendigkeit halber notiert.
- **Loesung:** Optional konstanter Vergleich (z. B. Laenge + XOR/crypto.timingSafeEqual-Aequivalent). Niedrigste Prioritaet.

### 64. Datenschutz/AGB mit festem Datum '10. Juni 2026' – Versionspflege nicht an Consent gekoppelt
- **Bereich:** legal-de
- **Stelle:** `app/lib/legal.ts:121`
- **Problem:** PRIVACY_SECTIONS (legal.ts:121) und TERMS_SECTIONS (legal.ts:206) tragen ein hartkodiertes 'Stand 10. Juni 2026'. Protokolliert wird beim Onboarding (OnboardingScreen.tsx:128) aber nur DISCLAIMER_VERSION ('1.1', legal.ts:3) – es gibt keine separate Versionsnummer fuer Datenschutz/AGB und keine Re-Prompt-Logik bei Aenderung dieser Texte. Aendert sich kuenftig die Datenschutz-/AGB-Fassung, gibt es weder einen erneuten Kenntnisnahme-/Einwilligungs-Flow noch einen Nachweis, welche Fassung ein Bestandsnutzer akzeptiert hat. Heute kein Fehler, aber relevant fuer kuenftige Aenderungen.
- **Loesung:** Pro Rechtstext eine Versionskonstante (PRIVACY_VERSION/TERMS_VERSION) einfuehren, beim Consent serverseitig mitschreiben und bei Versionsspruengen einen kurzen erneuten Kenntnisnahme-Hinweis zeigen.

### 65. Idee: PREMIUM_PRICE hartkodiert statt aus dem Store-Produkt gelesen
- **Bereich:** apple-guidelines
- **Stelle:** `app/components/Paywall.tsx:15`
- **Problem:** Der Preis 9,99 EUR / Monat ist als Konstante hartkodiert (auch im Fineprint Paywall.tsx:141 und in legal.ts). 3.1.2 wird aktuell erfuellt, der richtige Preis ist sichtbar. Bei spaeteren Preisaenderungen oder anderen Regionen/Waehrungen weicht der angezeigte Preis vom tatsaechlich abgerechneten Apple-Preis ab, was perspektivisch eine 3.1.2-Beanstandung wegen irrefuehrender Preisangabe ausloesen kann. Kein Blocker fuer Launch in DE/EUR.
- **Loesung:** Perspektivisch den lokalisierten Preis aus dem RevenueCat-Package (pkg.product.priceString) anzeigen statt der Konstante. Optional fuer spaeter.

### 66. VERIFIZIERT OK: neue a11y-Labels und textMuted-Kontrast korrekt
- **Bereich:** ux-a11y
- **Stelle:** `app/components/BackButton.tsx:12-13`
- **Problem:** Kein Fehler - Bestaetigung der heutigen Fixes. BackButton hat accessibilityRole button + accessibilityLabel (Default Zurueck) und grosszuegigen hitSlop 16/16/16/28. HomeScreen-Labels sind sinnvoll und dynamisch: levelPill (215), Stat Label-value-sub (330), Erfolge-Trigger X-von-N (270), achRow accessible mit Name+Beschreibung+Status (297), Training beenden (257), Erfolge schliessen (308). textMuted #555C66 erreicht ueberall AA (5,97 auf bg, 6,36-6,75 auf Karten). MainTabs-Tabs haben accessibilityRole tab + selected-State + adjustsFontSizeToFit. Nur Bestaetigung, keine Aktion noetig.
- **Loesung:** Keine Aenderung noetig.

### 67. Kein Crash-/Fehler-Monitoring (nur lokale ErrorBoundary)
- **Bereich:** config-build-hygiene
- **Stelle:** `app/components/ErrorBoundary.tsx`
- **Problem:** grep nach sentry/bugsnag/crashlytics liefert nur die eigene ErrorBoundary.tsx - kein externes Crash-Reporting eingebunden. Fuer den ersten TestFlight reicht das (Apple/Xcode liefern symbolisierte Crash-Logs), aber JS-Fehler/Abstuerze bei echten Testern bleiben sonst unsichtbar. Bewusst als idea, nicht als Blocker.
- **Loesung:** Optional vor breiterem Beta: expo-kompatibles Sentry (@sentry/react-native via Expo-Plugin, SDK-54-passend) ergaenzen, um TestFlight-Crashes zentral zu sehen. Nicht zwingend fuer den ersten Build.


---

## Verworfen (Fehlalarme der Pruefer)

- **parse-meal: Antwort-Extraktion bei json_schema-Strukturausgabe greift evtl. ins Leere -> KI liefert nie Treffer fuer Premium-Nutzer** (edge-functions) - Code in supabase/functions/parse-meal/index.ts:129+138 verifiziert. Die offizielle Anthropic-Doku (claude-api Skill, Structured Outputs) bestaetigt genau diese Form: 'output_config: {format: {type: "json_schema", schema: SCHEMA}}' ist der kanonische (NICHT veraltete) Parameter, und das garantierte JSON kommt 'in the first block ... text with valid JSON' zurueck - das dokumentierte Extraktionsmuster ist woertlich 'next(b.text for b in content if b.type=="text")', identisch zu Zeile 138. claude-haiku-4-5 unterstuetzt Structured Outputs laut Skill (models.md). Die Behauptung 'greift evtl. ins Leere'/'liefert nie Treffer' ist damit widerlegt: bei json_schema MUSS die Ausgabe im text-Block stehen, der Fallback {"items":[]} ist nur ein defensiver Sicherungsfall. Der 400-Risiko-Pfad (output_config nicht akzeptiert) ist Spekulation ueber eine veraltete API-Version - der Code laeuft gegen api.anthropic.com mit anthropic-version 2023-06-01, wo output_config GA ist. Bei r.ok=false wird sauber 502 'ai_error' geliefert + Status/Body geloggt (Zeile 132-135), kein stiller Totalausfall. Reiner Live-Test-Hinweis ist sinnvoll, aber kein im Code belegbarer Defekt -> isReal=false. Severity von high auf medium reduziert, falls man den Live-Test-Vorbehalt als offenen Punkt fuehren will.
- **App-Icon ist nahezu vollstaendig transparent -> ITMS-90717-Upload-Risiko / weisses Icon auf iOS** (ios-testflight) - WIDERLEGT durch eigene PNG-Dekodierung (Node/zlib, manuelles Un-Filtering). app/assets/icon.png ist 1024x1024, colorType=6 (RGBA), aber das Alpha-Histogramm ist {"255": 1048576} — ALLE 1.048.576 Pixel haben Alpha=255 (voll deckend), 0 transparente und 0 semitransparente Pixel. Eckpixel (0,0)=(1023,0)=RGBA[232,246,239,255] = opake Markenfarbe ~#E8F6EF (passt zu Splash/Adaptive #EAF7F0), Zentrum (512,512)=[198,110,40,255] (Avocado-Kern, opak), Ecke (1023,1023)=[251,254,252,255]. Das Icon ist also das Avocado-Logo auf VOLLFLAECHIG deckendem Mint-Hintergrund — genau was Apple verlangt. Die Behauptung '1.048.430 Pixel mit Alpha=0' ist faktisch falsch (echter Wert: 0). Decoder verifiziert korrekt, weil er fuer assets/splash-icon.png erwartungsgemaess 54,11% Alpha=0 / 35,71% Alpha=255 / 106.819 semi liefert. Kein ITMS-90717- und kein Weiss-Icon-Risiko. app.json:44-50 hat zudem keinen ios.icon-Override, einzige Quelle ist die opake icon.png. Kein Defekt.
- **test_-RevenueCat-Key im Build: echte Kaeufe scheitern, Ablehnung nach 3.1.2/2.1 bei oeffentlicher Submission** (apple-guidelines) - Code-Verifikation korrekt: purchases.ts:12-17 nimmt EXPO_PUBLIC_REVENUECAT_IOS_KEY/ANDROID_KEY und faellt auf EXPO_PUBLIC_REVENUECAT_KEY zurueck; .env enthaelt tatsaechlich EXPO_PUBLIC_REVENUECAT_KEY=test_n... und KEINE appl_/goog_-Keys (Grep: appl_/goog_ nur in .env.example als Platzhalter), eas.json production hat keinen env-Block. ABER: Der Auftrag nennt den test_-Key fuer TestFlight ausdruecklich als bekannten/gewollten Zustand, und der Befund selbst raeumt ein, dass es fuer TestFlight tolerierbar und nur fuer die spaetere oeffentliche Submission relevant ist (APP-STORE-CHECKLIST.md:72-73 dokumentiert es). Damit kein zusaetzlicher Defekt, sondern gewollt -> isReal=false. Fuer die oeffentliche Submission bleibt die Aktion (appl_-Key im EAS-Profil) gueltig, daher als low-Erinnerung statt Blocker.
- **usesNonExemptEncryption:false bei HTTPS-Standardnutzung bewusst bestaetigen** (apple-guidelines) - Code-Verifikation korrekt: app.json:47-49 setzt usesNonExemptEncryption=false; die App nutzt nur Standard-HTTPS (Supabase, api.anthropic.com via Edge Function in parse-meal/index.ts:121, Open Food Facts). Der Befund selbst sagt 'Keine Aenderung noetig; Angabe so belassen' und 'keine Crash-Quelle' - es ist also KEIN Defekt, sondern eine korrekte Selbsterklaerung. isReal=false; als idea/Bestaetigungshinweis statt low eingestuft.
- **Health/Fitness-Privacy-Label nicht mit iOS-HealthKit verwechseln (Code hier korrekt)** (apple-guidelines) - Code-Verifikation bestaetigt und es ist explizit kein Defekt: health.ts:9-22 laedt react-native-health-connect nur lazy via require() und nur auf Platform.OS==='android'; Grep ueber app/ nach HealthKit/NSHealth/react-native-health/expo-health ergab KEINE Treffer (nur Health Connect). Kein NSHealthShareUsageDescription, keine Apple-Health-Berechtigung. APP-STORE-CHECKLIST.md:24 stellt das korrekt klar. Der Befund ist selbst als 'Code hier korrekt / keine Code-Aenderung' formuliert -> isReal=false, idea.
