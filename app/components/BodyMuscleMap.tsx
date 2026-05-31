// Interaktiver, realistischer menschlicher Koerper (Vorder-/Rueckseite) als Muskel-Schaubild.
// Nutzt react-native-body-highlighter (echte anatomische Pfade) und mappt die Muskeln
// auf unsere Datenbank-Keys.
import { useState } from 'react';
import { Dimensions, Text, View } from 'react-native';
import Body, { ExtendedBodyPart, Slug } from 'react-native-body-highlighter';
import { Colors } from '../contexts/ThemeContext';
import Segmented from './Segmented';

const LABELS: Record<string, string> = {
  chest: 'Brust', back: 'Rücken', shoulders: 'Schultern', biceps: 'Bizeps', triceps: 'Trizeps',
  abs: 'Bauch', legs: 'Beine', calves: 'Waden', glutes: 'Gesäß',
};

// Slug der Bibliothek -> unser Muskel-Key (Datenbank)
const SLUG_TO_KEY: Partial<Record<Slug, string>> = {
  chest: 'chest', biceps: 'biceps', triceps: 'triceps', deltoids: 'shoulders',
  abs: 'abs', obliques: 'abs', trapezius: 'back', 'upper-back': 'back', 'lower-back': 'back',
  quadriceps: 'legs', hamstring: 'legs', adductors: 'legs', calves: 'calves', gluteal: 'glutes',
};
// unser Key -> alle zugehoerigen Slugs (zum Hervorheben des gewaehlten Muskels)
const KEY_TO_SLUGS: Record<string, Slug[]> = {
  chest: ['chest'], biceps: ['biceps'], triceps: ['triceps'], shoulders: ['deltoids'],
  abs: ['abs', 'obliques'], back: ['trapezius', 'upper-back', 'lower-back'],
  legs: ['quadriceps', 'hamstring', 'adductors'], calves: ['calves'], glutes: ['gluteal'],
};

// alle anklickbaren Slugs (fuer den dezenten Hinweis "hier kann man tippen")
const CLICKABLE_SLUGS = Object.keys(SLUG_TO_KEY) as Slug[];

// zwei Farben mischen (t = 0 -> a, t = 1 -> b)
function mix(a: string, b: string, t: number): string {
  const parse = (h: string) => {
    const x = h.replace('#', '');
    const f = x.length === 3 ? x.split('').map((ch) => ch + ch).join('') : x;
    return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
  };
  const [ar, ag, ab] = parse(a), [br, bg, bb] = parse(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${m(ar, br)}${m(ag, bg)}${m(ab, bb)}`;
}

export default function BodyMuscleMap({
  onSelect,
  selectedKey,
  c,
  gender = 'male',
}: {
  onSelect: (key: string) => void;
  selectedKey?: string | null;
  c: Colors;
  gender?: 'male' | 'female';
}) {
  const [side, setSide] = useState<'front' | 'back'>('front');
  const W = Math.min(230, Dimensions.get('window').width - 110);
  const scale = W / 200; // Body ist intrinsisch 200 x 400 (mal scale)

  // Anklickbare Muskeln nur minimal hervorheben (zarter Farbton);
  // der aktuell gewaehlte Muskel etwas klarer (aber zurueckhaltend).
  const tint = mix(c.card, c.primary, 0.14);
  const selSlugs = selectedKey ? KEY_TO_SLUGS[selectedKey] ?? [] : [];
  const data: ExtendedBodyPart[] = CLICKABLE_SLUGS.map((slug) => {
    const sel = selSlugs.includes(slug);
    return {
      slug,
      styles: sel
        ? { fill: c.primary, stroke: c.accent, strokeWidth: 4 }
        : { fill: tint, stroke: c.border, strokeWidth: 2 },
    };
  });

  return (
    <View style={{ alignItems: 'center', width: '100%' }}>
      <View style={{ width: '100%', maxWidth: 320 }}>
        <Segmented
          options={[{ key: 'front', label: 'Vorderseite' }, { key: 'back', label: 'Rückseite' }]}
          value={side}
          onChange={(s) => setSide(s as 'front' | 'back')}
          c={c}
        />
      </View>

      <View style={{ marginTop: 16 }}>
        <Body
          side={side}
          gender={gender}
          scale={scale}
          data={data}
          colors={[c.primary]}
          defaultFill={c.card}
          defaultStroke={c.border}
          defaultStrokeWidth={2}
          border={c.textMuted}
          onBodyPartPress={(b) => {
            const k = b.slug ? SLUG_TO_KEY[b.slug] : undefined;
            if (k) onSelect(k);
          }}
        />
      </View>

      <Text style={{ color: selectedKey ? c.primary : c.textMuted, fontSize: 14, marginTop: 8, fontWeight: selectedKey ? '700' : '400' }}>
        {selectedKey ? `Ausgewählt: ${LABELS[selectedKey] ?? ''}` : 'Tippe einen Muskel an'}
      </Text>
    </View>
  );
}
