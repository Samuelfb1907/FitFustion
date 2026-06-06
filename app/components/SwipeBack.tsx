// Wisch-nach-rechts (vom linken Rand) = zurueck – wie in iOS/Standard-Apps.
// Wrapper um einen Screen-Inhalt; nutzt PanResponder (keine zusaetzliche Abhaengigkeit).
// Reagiert NUR auf Gesten, die am linken Rand starten und klar horizontal sind
// -> vertikales Scrollen und horizontale Listen werden nicht gestoert.
import { ReactNode, useRef } from 'react';
import { PanResponder, StyleProp, View, ViewStyle } from 'react-native';

export default function SwipeBack({ onBack, children, style }: { onBack: () => void; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.x0 < 40 && g.dx > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderRelease: (_, g) => {
        if (g.dx > 70 && Math.abs(g.dx) > Math.abs(g.dy)) onBackRef.current();
      },
    }),
  ).current;
  return (
    <View style={[{ flex: 1 }, style]} {...responder.panHandlers}>
      {children}
    </View>
  );
}
