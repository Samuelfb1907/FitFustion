# FitAvo – E-Mail-Vorlagen für Supabase Auth

So einfügen: **Supabase-Dashboard → Authentication → Emails → Templates** → jeweilige Vorlage wählen →
**Subject heading** (Betreff) und **Message body** (HTML) ersetzen → speichern.

> ⚠️ Platzhalter wie **`{{ .ConfirmationURL }}`** (Link) bzw. **`{{ .Token }}`** (6-stelliger Code) müssen
> **genau so** stehen bleiben – Supabase setzt dort automatisch den persönlichen Wert ein.
>
> **WICHTIG (Passwort-Reset):** Die Vorlage „Reset Password" unten nutzt den **Code `{{ .Token }}`** und
> NICHT den Link – denn die App setzt das Passwort per 6-stelligem Code zurück. Schickt die Vorlage einen
> Link statt des Codes, schlägt das Zurücksetzen in der App fehl.
> (Absender-Name & -Adresse stellst du separat unter *SMTP Settings* ein, nicht hier.)

---

## 1) Passwort zurücksetzen  ·  Template „Reset Password"

**Betreff:**
```
FitAvo – Passwort zurücksetzen
```

**Inhalt (HTML):**
```html
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1A2230;">
  <h1 style="font-size:22px;color:#16224A;margin:0 0 4px;">FitAvo 🏋️</h1>
  <h2 style="font-size:18px;color:#16224A;margin:16px 0 8px;">Passwort zurücksetzen</h2>
  <p style="font-size:15px;line-height:1.5;">Du hast angefordert, dein Passwort zurückzusetzen. Gib diesen 6-stelligen Code in der FitAvo-App ein:</p>
  <p style="text-align:center;margin:28px 0;">
    <span style="font-size:34px;font-weight:800;letter-spacing:8px;color:#16224A;">{{ .Token }}</span>
  </p>
  <p style="font-size:13px;color:#7C8AA0;line-height:1.5;">Der Code ist etwa 1 Stunde gültig. Gib ihn im Fenster „Passwort zurücksetzen" der App ein.</p>
  <p style="font-size:13px;color:#7C8AA0;line-height:1.5;margin-top:16px;">Wenn du das nicht warst, ignoriere diese E-Mail einfach – dein Passwort bleibt unverändert.</p>
  <hr style="border:none;border-top:1px solid #E4EAF3;margin:24px 0;">
  <p style="font-size:12px;color:#7C8AA0;">FitAvo · automatisch versendete E-Mail</p>
</div>
```

---

## 2) E-Mail bestätigen  ·  Template „Confirm signup"

**Betreff:**
```
FitAvo – E-Mail-Adresse bestätigen
```

**Inhalt (HTML):**
```html
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1A2230;">
  <h1 style="font-size:22px;color:#16224A;margin:0 0 4px;">FitAvo 🏋️</h1>
  <h2 style="font-size:18px;color:#16224A;margin:16px 0 8px;">Willkommen! Bitte bestätige deine E-Mail</h2>
  <p style="font-size:15px;line-height:1.5;">Schön, dass du dabei bist. Bestätige deine E-Mail-Adresse, um dein FitAvo-Konto zu aktivieren:</p>
  <p style="text-align:center;margin:24px 0;">
    <a href="{{ .ConfirmationURL }}" style="background:#2B50D8;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;display:inline-block;">E-Mail bestätigen</a>
  </p>
  <p style="font-size:13px;color:#7C8AA0;line-height:1.5;">Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>
  <a href="{{ .ConfirmationURL }}" style="color:#2B50D8;word-break:break-all;">{{ .ConfirmationURL }}</a></p>
  <p style="font-size:13px;color:#7C8AA0;line-height:1.5;margin-top:16px;">Wenn du dich nicht registriert hast, kannst du diese E-Mail ignorieren.</p>
  <hr style="border:none;border-top:1px solid #E4EAF3;margin:24px 0;">
  <p style="font-size:12px;color:#7C8AA0;">FitAvo · automatisch versendete E-Mail</p>
</div>
```

---

## 3) Optional: E-Mail-Adresse ändern  ·  Template „Change Email Address"

**Betreff:**
```
FitAvo – E-Mail-Adresse ändern bestätigen
```

**Inhalt (HTML):**
```html
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1A2230;">
  <h1 style="font-size:22px;color:#16224A;margin:0 0 4px;">FitAvo 🏋️</h1>
  <h2 style="font-size:18px;color:#16224A;margin:16px 0 8px;">E-Mail-Adresse ändern</h2>
  <p style="font-size:15px;line-height:1.5;">Bestätige die Änderung deiner E-Mail-Adresse für dein FitAvo-Konto:</p>
  <p style="text-align:center;margin:24px 0;">
    <a href="{{ .ConfirmationURL }}" style="background:#2B50D8;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;display:inline-block;">Änderung bestätigen</a>
  </p>
  <p style="font-size:13px;color:#7C8AA0;line-height:1.5;">Wenn du das nicht angefordert hast, ignoriere diese E-Mail.</p>
  <hr style="border:none;border-top:1px solid #E4EAF3;margin:24px 0;">
  <p style="font-size:12px;color:#7C8AA0;">FitAvo · automatisch versendete E-Mail</p>
</div>
```

---

### Hinweise
- **Absender** (Name „FitAvo" + Adresse `noreply@deinedomain.de`) stellst du unter
  *Authentication → Emails → SMTP Settings* ein – nicht in der Vorlage.
- Mit dem **Standard-Supabase-Absender** (ohne eigenes SMTP) funktionieren die Vorlagen auch,
  sind aber limitiert (wenige Mails/Stunde) und landen häufiger im Spam → für Release **Custom SMTP**.
- Farben entsprechen dem App-Branding (Primär `#2B50D8`, Überschrift `#16224A`).
