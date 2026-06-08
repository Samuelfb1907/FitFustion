// Interaktives Wisch-zurueck mit echter Tiefe: die VORHERIGE Seite (`behind`) liegt
// statisch hinten, die aktuelle Seite (`children`) liegt darueber und folgt beim
// Wischen vom linken Rand dem Finger nach rechts -> die vorherige Seite wird sichtbar
// (mit leichtem Parallax wie in iOS). Loslassen: weit genug / schneller Flick ->
// ganz raus + onBack(); sonst zurueckfedern. Animated + PanResponder (keine Abhaengigkeit).
//
// `behind` + `c` optional: ohne sie verhaelt sich SwipeBack wie ein einfaches
// Weg-Wischen (transparente Seite) – fuer einen schrittweisen Rollout.
import { ReactNode, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors } from '../contexts/ThemeContext';
import Ambient from './Ambient';

const SCREEN_W = Dimensions.get('window').width;

export default function SwipeBack({
  onBack,
  children,
  behind,
  c,
  style,
}: {
  onBack: () => void;
  children: ReactNode;
  behind?: ReactNode;
  c?: Colors;
  style?: StyleProp<ViewStyle>;
}) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const tx = useRef(new Animated.Value(0)).current;

  // Damit die Rand-Wischgeste auch greift, wenn diese SwipeBack in einem
  // eingerueckten Container sitzt (z.B. Essen-Hub mit Seitenrand): den eigenen
  // Bildschirm-Versatz messen und die wischbare Seite bis an den ECHTEN
  // Bildschirmrand ziehen (negativer Aussenabstand), den Inhalt per Padding aber
  // wieder an seine Position schieben. Bei randlosen Seiten ist der Versatz 0.
  const outerRef = useRef<View>(null);
  const [insetL, setInsetL] = useState(0);
  const [insetR, setInsetR] = useState(0);
  const measure = () => {
    outerRef.current?.measureInWindow((x, _y, w) => {
      setInsetL(Math.max(0, Math.round(x)));
      setInsetR(Math.max(0, Math.round(SCREEN_W - x - w)));
    });
  };

  const responder = useRef(
    PanResponder.create({
      // Auch VOR scrollbaren Kindern (FlatList/ScrollView) greifen: nur bei klarer
      // Wisch-Geste vom linken Rand -> sonst scrollt/tippt das Kind normal weiter.
      onMoveShouldSetPanResponderCapture: (_, g) => g.x0 < 40 && g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onMoveShouldSetPanResponder: (_, g) => g.x0 < 40 && g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onPanResponderMove: (_, g) => tx.setValue(Math.max(0, g.dx)),
      onPanResponderRelease: (_, g) => {
        const back = g.dx > SCREEN_W * 0.33 || (g.dx > 60 && g.vx > 0.3);
        if (back) {
          Animated.timing(tx, { toValue: SCREEN_W, duration: 180, useNativeDriver: true }).start(() => {
            onBackRef.current();
            // tx erst im NAECHSTEN Frame zuruecksetzen: Wird diese Seite entfernt
            // (Normalfall), ist sie dann schon weg -> kein Zurueckschnappen/Flackern.
            // Wird dieselbe SwipeBack-Instanz aber wiederverwendet (anderer Inhalt im
            // selben Slot, z.B. Uebungsdetail -> Uebungsliste), MUSS tx zurueck auf 0,
            // sonst bleibt der neue Inhalt rechts ausserhalb des Bildes (haengt).
            requestAnimationFrame(() => tx.setValue(0));
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

  // Vorherige Seite leicht nach links versetzt mitlaufen lassen (Parallax wie iOS).
  const behindTx = tx.interpolate({ inputRange: [0, SCREEN_W], outputRange: [-SCREEN_W * 0.25, 0], extrapolate: 'clamp' });
  // Im Ruhezustand (tx=0) komplett unsichtbar -> kein Durchblitzen am Rand; ab dem ersten
  // Wisch-Pixel sofort sichtbar.
  const behindOpacity = tx.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View ref={outerRef} onLayout={measure} style={[{ flex: 1 }, style]}>
      {behind != null && (
        <Animated.View
          style={[StyleSheet.absoluteFill, c ? { backgroundColor: c.bg } : null, { opacity: behindOpacity, transform: [{ translateX: behindTx }] }]}
          pointerEvents="none"
        >
          {c && <Ambient c={c} />}
          {behind}
        </Animated.View>
      )}
      <Animated.View
        style={[
          styles.page,
          c ? { backgroundColor: c.bg } : null,
          // Seite bis zum echten Bildschirmrand ziehen (Geste am Rand), Inhalt per Padding zurueck.
          { marginLeft: -insetL, marginRight: -insetR, paddingLeft: insetL, paddingRight: insetR, transform: [{ translateX: tx }] },
        ]}
        {...responder.panHandlers}
      >
        {c && <Ambient c={c} />}
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: -3, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
});
