# FitAvo – Hinweise für KI-/Entwickler-Sitzungen

- **Expo SDK 54** (React Native 0.81, React 19, TypeScript). NICHT auf eine neuere
  SDK upgraden – das Projekt ist bewusst auf 54 festgelegt.
  Versionierte Doku: https://docs.expo.dev/versions/v54.0.0/
- App-Sprache: durchgehend **Deutsch**, "du"-Form.
- Backend: **Supabase** (Postgres + RLS, Auth, Edge Functions in `supabase/functions/`).
- In-App-Käufe: **RevenueCat** (`react-native-purchases`). Test über RevenueCat Test Store.
- Secrets ausschließlich in `app/.env` (gitignored). Der `service_role`-Key gehört
  NUR in Edge Functions, niemals ins Client-Bundle.
- Native Module (Health Connect, RevenueCat) brauchen einen Development-/EAS-Build;
  in Expo Go nicht testbar.
