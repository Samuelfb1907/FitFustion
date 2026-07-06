// Aktuelle Tastaturhoehe in px (0 = zu). Fuer Modals/Bottom-Sheets/Chat-Leisten, wo
// KeyboardAvoidingView (bzw. Android-adjustResize) unzuverlaessig ist - besonders in
// RN-Modals. iOS: will-Events (glatt animiert), Android: did-Events.
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e) => setHeight(e.endCoordinates?.height ?? 0));
    const h = Keyboard.addListener(hideEvt, () => setHeight(0));
    return () => { s.remove(); h.remove(); };
  }, []);
  return height;
}
