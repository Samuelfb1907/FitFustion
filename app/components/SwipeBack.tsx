// Interaktives Wisch-zurueck (vom linken Rand) – die Seite folgt dem Finger und
// gleitet nach rechts weg, wie in iOS/Standard-Apps. Beim Loslassen:
//   - weit genug / schneller Flick  -> Seite gleitet ganz raus, dann onBack()
//   - sonst                         -> Seite federt zurueck.
// Nutzt Animated + PanResponder (keine zusaetzliche Abhaengigkeit). Reagiert nur
// auf Gesten, die am linken Rand starten und klar horizontal sind -> vertikales
// Scrollen und horizontale Listen werden nicht gestoert.
import { ReactNode, useRef } from 'react';
import { Animated, Dimensions, PanResponder, StyleProp, StyleSheet, ViewStyle } from 'react-native';

const SCREEN_W = Dimensions.get('window').width;

export default function SwipeBack({ onBack, children, style }: { onBack: () => void; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const tx = useRef(new Animated.Value(0)).current;

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.x0 < 40 && g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onPanResponderMove: (_, g) => {
        tx.setValue(Math.max(0, g.dx)); // folgt dem Finger, nur nach rechts
      },
      onPanResponderRelease: (_, g) => {
        const shouldBack = g.dx > SCREEN_W * 0.33 || (g.dx > 60 && g.vx > 0.3);
        if (shouldBack) {
          Animated.timing(tx, { toValue: SCREEN_W, duration: 180, useNativeDriver: true }).start(() => {
            onBackRef.current();
            tx.setValue(0); // zuruecksetzen, falls der Wrapper bestehen bleibt
          });
        } else {
          Animated.spring(tx, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 16 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(tx, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 16 }).start();
      },
    }),
  ).current;

  return (
    <Animated.View style={[styles.page, style, { transform: [{ translateX: tx }] }]} {...responder.panHandlers}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    // Schatten an der linken Kante -> wirkt, als laege die Seite ueber der vorherigen,
    // waehrend man sie wegwischt (nur sichtbar, wenn die Seite nach rechts verschoben ist).
    shadowColor: '#000',
    shadowOffset: { width: -3, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
});
