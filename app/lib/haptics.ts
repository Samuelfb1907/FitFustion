// Haptisches Feedback (expo-haptics). expo-haptics ist in Expo Go gebuendelt UND im Build
// vorhanden, daher statischer Import ok. Aufrufe sind fire-and-forget + fehlertolerant
// (.catch), damit sie auf Web/nicht unterstuetzten Geraeten still no-op bleiben.
import * as Haptics from 'expo-haptics';

// Leichtes Tippen-Feedback: z. B. Satz gespeichert, +1 Glas Wasser.
export function hTap(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

// Erfolgs-Feedback: z. B. neuer persoenlicher Rekord, Tagesziel erreicht, Training beendet.
export function hSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
