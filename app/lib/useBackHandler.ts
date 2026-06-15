// Android-System-Zurueck abfangen (Hardware-Zurueck-Knopf UND die Wisch-Geste
// von beiden Bildschirmraendern - beides loest auf Android dasselbe "hardwareBackPress"
// aus). Die App nutzt KEINE React Navigation, sondern navigiert ueber eigenen State;
// ohne diesen Hook wuerde Zurueck die ganze App schliessen, statt eine Ebene zurueckzugehen.
//
// `onBack` wird beim Zurueck-Ereignis aufgerufen:
//   - Gibt es etwas zurueckzunavigieren -> dort zuruecknavigieren und `true` zurueckgeben
//     (Ereignis verbraucht, die App bleibt offen).
//   - Sonst `false` zurueckgeben -> der naechste registrierte Handler bzw. das System
//     uebernimmt (die App schliesst sich erst, wenn niemand mehr zurueck kann).
//
// React Native ruft mehrere Handler in UMGEKEHRTER Registrier-Reihenfolge auf (der
// zuletzt registrierte zuerst). Da Unter-Screens ihren Handler erst beim Sichtbarwerden
// registrieren, kommt automatisch der tiefste sichtbare Screen zuerst dran; ein globaler
// Fallback (in MainTabs) wird ganz zuerst registriert und kommt daher zuletzt.
//
// Nur Android. Auf iOS passiert nichts (dort gibt es die Links-nach-Rechts-Wisch-Geste
// ueber die SwipeBack-Komponente).
import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

export function useAndroidBack(onBack: () => boolean, active: boolean = true): void {
  // Per Ref immer die aktuellste Closure aufrufen, ohne bei jedem Render neu zu
  // registrieren (sonst aenderte sich die Reihenfolge der Handler staendig).
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (Platform.OS !== 'android' || !active) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => ref.current());
    return () => sub.remove();
  }, [active]);
}
