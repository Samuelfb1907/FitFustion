// Einstellungen-Screen (Menue, Unterseiten, Dialoge, Passwort) - DE/EN.
// Schluessel in BEIDE Woerterbuecher eintragen; {param} wird interpoliert.
export const de = {
  // Bereichstitel + Basis
  'settings.title': 'Einstellungen',
  'settings.section.account': 'KONTO',
  'settings.section.appearance': 'DARSTELLUNG',
  'settings.section.language': 'SPRACHE',
  'settings.section.reminders': 'ERINNERUNGEN',
  'settings.section.health': 'GESUNDHEIT',
  'settings.section.data': 'DATEN',
  'settings.section.privacy': 'DATENSCHUTZ (DSGVO)',
  'settings.section.legal': 'RECHTLICHES',
  'settings.section.about': 'ÜBER',
  'settings.language': 'Sprache',
  'settings.logout': 'Abmelden',

  // Buttons (Dialoge)
  'settings.btn.cancel': 'Abbrechen',
  'settings.btn.connect': 'Verbinden',
  'settings.btn.open': 'Öffnen',
  'settings.btn.continue': 'Fortfahren',
  'settings.btn.deleteForever': 'Endgültig löschen',
  'settings.btn.ok': 'OK',

  // Konto
  'settings.menu.editProfile': 'Profil bearbeiten',
  'settings.menu.email': 'E-Mail',
  'settings.menu.changePassword': 'Passwort ändern',

  // Darstellung
  'settings.appearance.title': 'Erscheinungsbild',
  'settings.appearance.system': 'Automatisch',
  'settings.appearance.light': 'Hell',
  'settings.appearance.dark': 'Dunkel',
  'settings.appearance.systemHint': 'Folgt automatisch dem Hell-/Dunkel-Modus deines Geräts.',

  // Erinnerungen
  'settings.rem.active': 'Erinnerungen aktiv',
  'settings.rem.permissionNeeded': 'Bitte Benachrichtigungen für die App erlauben (Handy-Einstellungen).',
  'settings.rem.water': 'Wasser trinken',
  'settings.rem.waterA11y': 'Erinnerung Wasser trinken',
  'settings.rem.training': 'Training',
  'settings.rem.trainingA11y': 'Erinnerung Training',
  'settings.rem.trainingTime': 'Trainingszeit',
  'settings.rem.trainingTimeEarlier': 'Trainingszeit eine Stunde früher',
  'settings.rem.trainingTimeLater': 'Trainingszeit eine Stunde später',
  'settings.rem.motivation': 'Tägliche Motivation',
  'settings.rem.motivationTime': 'Motivations-Uhrzeit',
  'settings.rem.motivationTimeEarlier': 'Motivations-Uhrzeit eine Stunde früher',
  'settings.rem.motivationTimeLater': 'Motivations-Uhrzeit eine Stunde später',
  'settings.rem.hint': 'Über 100 Motivationssprüche, 1× täglich zur gewählten Zeit. Wasser: 10/13/16/19 Uhr · Training zur gewählten Zeit. Echte Benachrichtigungen erscheinen erst nach einem Development-Build (in Expo Go nicht).',

  // Gesundheit (Android / Health Connect)
  'settings.health.alert.connectTitle': 'Mit Health Connect verbinden',
  'settings.health.alert.connectBody': 'FitAvo liest deine Schritte und – falls vorhanden – die von deiner Uhr gemessenen aktiven Kalorien. Diese Werte werden NUR auf deinem Gerät verwendet (zur Anrechnung aufs Tagesziel) und nicht an unsere Server übertragen oder dort gespeichert. Du kannst die Berechtigung jederzeit in Health Connect widerrufen.',
  'settings.health.alert.neededTitle': 'Health Connect nötig',
  'settings.health.alert.neededBody': 'Schritte auf Android laufen über „Health Connect" – und das braucht zusätzlich eine Schritt-Quelle. Installiere im Play Store „Health Connect" UND eine Schritt-App wie „Google Fit" (die schreibt deine Schritte hinein). Tippe auf „Öffnen", um Health Connect im Play Store zu öffnen, richte Google Fit ein und verbinde dann erneut.',
  'settings.health.connected': 'Verbunden ✓ – Schritte & Kalorien zählen jetzt mit.',
  'settings.health.noPermission': 'Keine Berechtigung erteilt.',
  'settings.health.connectedLink': 'Schritte verbunden ✓ (Health Connect)',
  'settings.health.connectLink': 'Mit Health Connect verbinden',
  'settings.health.hint': 'Rechnet deine Schritte (und – falls vorhanden – von einer Uhr gemessene aktive Kalorien) aufs Tagesziel an. Auf Android läuft das über Health Connect: Du brauchst die App „Health Connect" + eine Schritt-Quelle wie Google Fit. Nur im echten Build, nicht in Expo Go.',
  // iOS: eingebauter Schrittzaehler ("Bewegung & Fitness", kein HealthKit)
  'settings.health.ios.connectLink': 'Schritte aktivieren',
  'settings.health.ios.connectedLink': 'Schritte aktiv ✓',
  'settings.health.ios.hint': 'Liest den Schrittzähler deines iPhones (Bewegung & Fitness) und rechnet die Schritte aufs Tagesziel an. Diese Daten bleiben nur auf deinem Gerät.',
  'settings.health.ios.alert.connectTitle': 'Schritte aktivieren',
  'settings.health.ios.alert.connectBody': 'FitAvo liest die Schritte deines iPhones (Bewegung & Fitness), um sie aufs Tagesziel anzurechnen. Diese Daten bleiben NUR auf deinem Gerät und werden nicht an unsere Server gesendet. Du kannst die Berechtigung jederzeit in den iPhone-Einstellungen widerrufen.',
  'settings.health.ios.connected': 'Aktiviert ✓ – deine Schritte zählen jetzt aufs Tagesziel.',
  'settings.health.ios.denied': 'Keine Berechtigung. Du kannst „Bewegung & Fitness" für FitAvo in den iPhone-Einstellungen aktivieren.',
  'settings.health.ios.unavailable': 'Schrittzähler auf diesem Gerät nicht verfügbar.',

  // Daten
  'settings.data.redoTitle': 'Onboarding erneut durchlaufen?',
  'settings.data.redoBody': 'Du gibst deine Profilangaben neu ein. Deine bisherigen Trainings- und Essensdaten bleiben erhalten.',
  'settings.data.redoLink': 'Onboarding erneut durchlaufen',

  // Datenschutz (DSGVO)
  'settings.privacy.exportLink': 'Meine Daten exportieren',
  'settings.privacy.exportDialogTitle': 'FitAvo Datenexport',
  'settings.privacy.shareUnavailable': 'Teilen ist auf diesem Gerät nicht verfügbar.',
  'settings.privacy.exportFailed': 'Export fehlgeschlagen: {msg}',
  'settings.privacy.policyLink': 'Datenschutzerklärung',
  'settings.privacy.revokeAiLink': 'KI-Einwilligung widerrufen',
  'settings.privacy.revokeAiTitle': 'KI-Einwilligung widerrufen',
  'settings.privacy.revokeAiBody': 'Erledigt – vor der nächsten Nutzung der KI-Erkennung wirst du wieder um deine Zustimmung gebeten.',
  'settings.privacy.deleteLink': 'Konto & alle Daten löschen',
  'settings.privacy.deleteTitle': 'Konto & alle Daten löschen?',
  'settings.privacy.deleteBody': 'Dadurch werden ALLE deine Daten (Profil, Training, Ernährung, Fortschritt) unwiderruflich gelöscht. Dieser Schritt kann nicht rückgängig gemacht werden.',
  'settings.privacy.dataDeletedTitle': 'Daten gelöscht',
  'settings.privacy.dataDeletedBody': 'Alle deine Daten wurden gelöscht. Dein Login-Konto (E-Mail) konnte aktuell nicht automatisch vollständig entfernt werden. Für die endgültige Löschung des Kontos schreib uns bitte an Info@fitavo.eu. Du wirst jetzt abgemeldet.',
  'settings.privacy.deleteFailedDetail': 'Löschung fehlgeschlagen ({reason}). Bitte erneut versuchen.',
  'settings.privacy.deleteFailed': 'Löschung fehlgeschlagen: {msg}',

  // Rechtliches
  'settings.legal.disclaimerLink': 'Haftungsausschluss & Gesundheitshinweis',
  'settings.legal.disclaimerTitle': 'Rechtliches',
  'settings.legal.disclaimerHint': 'Impressum & Datenschutzerklärung findest du separat in den Einstellungen.',
  'settings.legal.privacyTitle': 'Datenschutzerklärung',
  'settings.legal.imprintLink': 'Impressum',
  'settings.legal.imprintTitle': 'Impressum',
  'settings.legal.termsLink': 'Nutzungsbedingungen',
  'settings.legal.termsTitle': 'Nutzungsbedingungen',

  // Passwort aendern
  'settings.pw.title': 'Passwort ändern',
  'settings.pw.current': 'Aktuelles Passwort',
  'settings.pw.new': 'Neues Passwort',
  'settings.pw.minHint': 'mindestens 8 Zeichen',
  'settings.pw.repeat': 'Neues Passwort wiederholen',
  'settings.pw.repeatPlaceholder': 'wiederholen',
  'settings.pw.forgotHint': 'Passwort vergessen? Melde dich ab und nutze im Login „Passwort vergessen?".',
  'settings.pw.minLength': 'Neues Passwort: mindestens 8 Zeichen.',
  'settings.pw.mismatch': 'Die neuen Passwörter stimmen nicht überein.',
  'settings.pw.wrongCurrent': 'Aktuelles Passwort ist falsch.',
  'settings.pw.changeFailed': 'Konnte Passwort nicht ändern: {msg}',
  'settings.pw.changed': 'Passwort geändert ✓',

  // Über
  'settings.about.app': 'App',
  'settings.about.version': 'Version',
};

export const en = {
  // Section titles + base
  'settings.title': "Settings",
  'settings.section.account': "ACCOUNT",
  'settings.section.appearance': "APPEARANCE",
  'settings.section.language': "LANGUAGE",
  'settings.section.reminders': "REMINDERS",
  'settings.section.health': "HEALTH",
  'settings.section.data': "DATA",
  'settings.section.privacy': "PRIVACY (GDPR)",
  'settings.section.legal': "LEGAL",
  'settings.section.about': "ABOUT",
  'settings.language': "Language",
  'settings.logout': "Log out",

  // Buttons (dialogs)
  'settings.btn.cancel': "Cancel",
  'settings.btn.connect': "Connect",
  'settings.btn.open': "Open",
  'settings.btn.continue': "Continue",
  'settings.btn.deleteForever': "Delete permanently",
  'settings.btn.ok': "OK",

  // Account
  'settings.menu.editProfile': "Edit profile",
  'settings.menu.email': "Email",
  'settings.menu.changePassword': "Change password",

  // Appearance
  'settings.appearance.title': "Appearance",
  'settings.appearance.system': "Automatic",
  'settings.appearance.light': "Light",
  'settings.appearance.dark': "Dark",
  'settings.appearance.systemHint': "Automatically follows your device's light/dark mode.",

  // Reminders
  'settings.rem.active': "Reminders on",
  'settings.rem.permissionNeeded': "Please allow notifications for the app (phone settings).",
  'settings.rem.water': "Drink water",
  'settings.rem.waterA11y': "Drink water reminder",
  'settings.rem.training': "Workout",
  'settings.rem.trainingA11y': "Workout reminder",
  'settings.rem.trainingTime': "Workout time",
  'settings.rem.trainingTimeEarlier': "Workout time one hour earlier",
  'settings.rem.trainingTimeLater': "Workout time one hour later",
  'settings.rem.motivation': "Daily motivation",
  'settings.rem.motivationTime': "Motivation time",
  'settings.rem.motivationTimeEarlier': "Motivation time one hour earlier",
  'settings.rem.motivationTimeLater': "Motivation time one hour later",
  'settings.rem.hint': "Over 100 motivational quotes, once a day at your chosen time. Water: 10/13/16/19h · workout at your chosen time. Real notifications only appear after a development build (not in Expo Go).",

  // Health (Android / Health Connect)
  'settings.health.alert.connectTitle': "Connect with Health Connect",
  'settings.health.alert.connectBody': "FitAvo reads your steps and – if available – the active calories measured by your watch. These values are used ONLY on your device (to count toward your daily goal) and are not sent to or stored on our servers. You can revoke the permission in Health Connect at any time.",
  'settings.health.alert.neededTitle': "Health Connect required",
  'settings.health.alert.neededBody': "Steps on Android go through \"Health Connect\", which also needs a step source. From the Play Store, install \"Health Connect\" AND a step app like \"Google Fit\" (it writes your steps into it). Tap \"Open\" to open Health Connect in the Play Store, set up Google Fit, then connect again.",
  'settings.health.connected': "Connected ✓ – steps & calories now count toward your goal.",
  'settings.health.noPermission': "No permission granted.",
  'settings.health.connectedLink': "Steps connected ✓ (Health Connect)",
  'settings.health.connectLink': "Connect with Health Connect",
  'settings.health.hint': "Counts your steps (and – if available – active calories measured by a watch) toward your daily goal. On Android this runs through Health Connect: you need the \"Health Connect\" app + a step source like Google Fit. Only in a real build, not in Expo Go.",
  // iOS: built-in step counter ("Motion & Fitness", not HealthKit)
  'settings.health.ios.connectLink': "Enable step counter",
  'settings.health.ios.connectedLink': "Steps active ✓",
  'settings.health.ios.hint': "Reads your iPhone's step counter (Motion & Fitness) and counts your steps toward your daily goal. This data stays on your device only.",
  'settings.health.ios.alert.connectTitle': "Enable step counter",
  'settings.health.ios.alert.connectBody': "FitAvo reads your iPhone's steps (Motion & Fitness) to count them toward your daily goal. This data stays ONLY on your device and is not sent to our servers. You can revoke the permission anytime in your iPhone settings.",
  'settings.health.ios.connected': "Activated ✓ – your steps now count toward your daily goal.",
  'settings.health.ios.denied': "No permission. You can enable \"Motion & Fitness\" for FitAvo in your iPhone settings.",
  'settings.health.ios.unavailable': "Step counter isn't available on this device.",

  // Data
  'settings.data.redoTitle': "Redo onboarding?",
  'settings.data.redoBody': "You'll re-enter your profile details. Your existing workout and meal data stay intact.",
  'settings.data.redoLink': "Redo onboarding",

  // Privacy (GDPR)
  'settings.privacy.exportLink': "Export my data",
  'settings.privacy.exportDialogTitle': "FitAvo data export",
  'settings.privacy.shareUnavailable': "Sharing isn't available on this device.",
  'settings.privacy.exportFailed': "Export failed: {msg}",
  'settings.privacy.policyLink': "Privacy policy",
  'settings.privacy.revokeAiLink': "Revoke AI consent",
  'settings.privacy.revokeAiTitle': "Revoke AI consent",
  'settings.privacy.revokeAiBody': "Done – you'll be asked for your consent again before the next use of AI recognition.",
  'settings.privacy.deleteLink': "Delete account & all data",
  'settings.privacy.deleteTitle': "Delete account & all data?",
  'settings.privacy.deleteBody': "This permanently deletes ALL your data (profile, workouts, nutrition, progress). This step cannot be undone.",
  'settings.privacy.dataDeletedTitle': "Data deleted",
  'settings.privacy.dataDeletedBody': "All your data has been deleted. Your login account (email) couldn't currently be fully removed automatically. For final deletion of the account, please write to us at Info@fitavo.eu. You'll now be signed out.",
  'settings.privacy.deleteFailedDetail': "Deletion failed ({reason}). Please try again.",
  'settings.privacy.deleteFailed': "Deletion failed: {msg}",

  // Legal
  'settings.legal.disclaimerLink': "Disclaimer & health notice",
  'settings.legal.disclaimerTitle': "Legal",
  'settings.legal.disclaimerHint': "You'll find the imprint & privacy policy separately in the settings.",
  'settings.legal.privacyTitle': "Privacy policy",
  'settings.legal.imprintLink': "Imprint",
  'settings.legal.imprintTitle': "Imprint",
  'settings.legal.termsLink': "Terms of use",
  'settings.legal.termsTitle': "Terms of use",

  // Change password
  'settings.pw.title': "Change password",
  'settings.pw.current': "Current password",
  'settings.pw.new': "New password",
  'settings.pw.minHint': "at least 8 characters",
  'settings.pw.repeat': "Repeat new password",
  'settings.pw.repeatPlaceholder': "repeat",
  'settings.pw.forgotHint': "Forgot your password? Sign out and use \"Forgot password?\" on the login screen.",
  'settings.pw.minLength': "New password: at least 8 characters.",
  'settings.pw.mismatch': "The new passwords don't match.",
  'settings.pw.wrongCurrent': "Current password is incorrect.",
  'settings.pw.changeFailed': "Couldn't change password: {msg}",
  'settings.pw.changed': "Password changed ✓",

  // About
  'settings.about.app': "App",
  'settings.about.version': "Version",
};
