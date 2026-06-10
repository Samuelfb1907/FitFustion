// AuthContext: stellt bereit, OB jemand eingeloggt ist (session) UND dessen Profil.
//
// WICHTIG (Supabase-Stolperstein): Im onAuthStateChange-Callback dürfen wir KEINE
// anderen Supabase-Aufrufe mit "await" machen – das kann zu einem Deadlock führen
// (App lädt endlos). Deshalb setzen wir im Callback nur die Session, und laden das
// Profil in einem SEPARATEN useEffect.
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type Profile = {
  id: string;
  first_name: string | null;
  gender: string | null;
  experience_level: string | null;
  training_environment: string | null;
  is_premium: boolean | null;
};

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isPremium: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  loading: true,
  isPremium: false,
  refreshProfile: async () => {},
});

const PROFILE_COLUMNS = 'id, first_name, gender, experience_level, training_environment, is_premium';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);          // erste Session-Prüfung fertig?
  const [profileUserId, setProfileUserId] = useState<string | null>(null); // für wen ist das Profil geladen?

  // 1) Session-Lebenszyklus – im Callback NUR die Session setzen (kein await auf DB!)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 2) Profil laden, sobald sich der eingeloggte Nutzer ändert (sicher außerhalb des Callbacks)
  useEffect(() => {
    if (!authReady) return;
    const userId = session?.user?.id ?? null;
    if (!userId) {
      setProfile(null);
      setProfileUserId(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select(PROFILE_COLUMNS)
          .eq('id', userId)
          .maybeSingle();
        if (active) setProfile(data ?? null);
      } catch {
        if (active) setProfile(null);
      } finally {
        if (active) setProfileUserId(userId);
      }
    })();
    return () => {
      active = false;
    };
  }, [authReady, session?.user?.id]);

  // Von aussen aufrufbar (z. B. nach dem Onboarding)
  const refreshProfile = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    const { data } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle();
    setProfile(data ?? null);
    setProfileUserId(userId);
  }, [session?.user?.id]);

  // Wir "laden" noch, solange die Session-Prüfung läuft ODER das Profil für den
  // aktuell eingeloggten Nutzer noch nicht geladen ist.
  const loading = !authReady || (!!session?.user && profileUserId !== session.user.id);
  const isPremium = !!profile?.is_premium;

  return (
    <AuthContext.Provider value={{ session, profile, loading, isPremium, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
