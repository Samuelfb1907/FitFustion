// Wandelt unbekannte Fehler (Netzwerk, Supabase) in eine kurze, freundliche deutsche Meldung.
// So sieht der Nutzer nie eine technische Fehlermeldung – und weiss, ob es am Internet liegt.
export function errorMessage(e: unknown): string {
  const raw = typeof e === 'string' ? e : (e as any)?.message ?? '';
  const lower = String(raw).toLowerCase();
  if (
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('econn') ||
    lower.includes('enotfound') ||
    lower.includes('offline')
  ) {
    return 'Keine Internetverbindung. Bitte prüfe deine Verbindung und versuche es erneut.';
  }
  return 'Die Daten konnten nicht geladen werden. Bitte versuche es erneut.';
}

// true, wenn der Fehler nach einem Verbindungsproblem aussieht.
export function isNetworkError(e: unknown): boolean {
  const lower = String(typeof e === 'string' ? e : (e as any)?.message ?? '').toLowerCase();
  return (
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('timeout') ||
    lower.includes('econn') ||
    lower.includes('offline')
  );
}
