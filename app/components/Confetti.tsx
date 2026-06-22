// Konfetti-Overlay (#72) - reine Animated-Implementierung, KEINE native Library
// (laeuft sofort in Expo Go). Bei jeder Aenderung von fireKey (>0) regnet es einmal.
// Fire-and-forget, pointerEvents="none" -> blockiert keine Eingaben; als oberste Ebene
// ueber den Screen legen.
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');
const COLORS = ['#19C98F', '#F0B429', '#3FA9F5', '#FF6B6B', '#9D7BF4', '#FF9F43'];
const N = 90;

type Piece = { x: number; w: number; h: number; color: string; delay: number; spins: number; drift: number };

export default function Confetti({ fireKey }: { fireKey: number }) {
  const pieces = useRef<Piece[]>(
    Array.from({ length: N }, (_, i) => ({
      x: Math.random() * W,
      w: 6 + Math.random() * 7,
      h: 9 + Math.random() * 8,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 300,
      spins: 1 + Math.random() * 3,
      drift: Math.random() * 100 - 50,
    })),
  ).current;
  const progress = useRef(pieces.map(() => new Animated.Value(0))).current;
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!fireKey) return;
    setActive(true);
    const anims = progress.map((v, i) => {
      v.setValue(0);
      return Animated.timing(v, {
        toValue: 1,
        duration: 1700 + pieces[i].delay,
        delay: pieces[i].delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
    });
    const group = Animated.parallel(anims);
    group.start(({ finished }) => { if (finished) setActive(false); });
    return () => group.stop();
  }, [fireKey]);

  if (!active) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const translateY = progress[i].interpolate({ inputRange: [0, 1], outputRange: [-30, H + 30] });
        const translateX = progress[i].interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] });
        const rotate = progress[i].interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spins * 360}deg`] });
        const opacity = progress[i].interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={{ position: 'absolute', left: p.x, top: 0, width: p.w, height: p.h, backgroundColor: p.color, borderRadius: 2, opacity, transform: [{ translateY }, { translateX }, { rotate }] }}
          />
        );
      })}
    </View>
  );
}
