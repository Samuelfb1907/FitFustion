// Interaktives Koerper-Schaubild (Vorder-/Rueckseite) als Muskel-Auswahl.
// Nutzt react-native-body-highlighter (echte anatomische Pfade). Ein Tipp auf einen
// Muskel ruft onSelect(key) -> der Training-Screen oeffnet direkt die Uebungen.
// Bewusst clean: einheitlich getoente Figur, dezente Konturen, kein Klick-Geblinke.
import { useState } from 'react';
import { Dimensions, Text, View } from 'react-native';
import Body, { ExtendedBodyPart, Slug } from 'react-native-body-highlighter';
import { Colors } from '../contexts/ThemeContext';
import Segmented from './Segmented';

// Slug der Bibliothek -> unser Muskel-Key (Datenbank)
const SLUG_TO_KEY: Partial<Record<Slug, string>> = {
  chest: 'chest', biceps: 'biceps', triceps: 'triceps', deltoids: 'shoulders',
  abs: 'abs', obliques: 'abs', trapezius: 'back', 'upper-back': 'back', 'lower-back': 'back',
  quadriceps: 'legs', hamstring: 'legs', adductors: 'legs', calves: 'calves', gluteal: 'glutes',
};
// Auf der VORDERSEITE zaehlt der dort nur schmal sichtbare Trizeps zum Bizeps,
// damit der ganze vordere Oberarm leicht antippbar ist (hinten bleibt er eigen).
function keyForSlug(slug: Slug | undefined, side: 'front' | 'back'): string | undefined {
  if (!slug) return undefined;
  if (side === 'front' && slug === 'triceps') return 'biceps';
  return SLUG_TO_KEY[slug];
}

const CLICKABLE_SLUGS = Object.keys(SLUG_TO_KEY) as Slug[];

export default function BodyMuscleMap({
  onSelect,
  c,
  gender = 'male',
}: {
  onSelect: (key: string) => void;
  c: Colors;
  gender?: 'male' | 'female';
}) {
  const [side, setSide] = useState<'front' | 'back'>('front');
  // Groessere Figur = groessere Tippziele (v.a. schmale Muskeln wie Bizeps).
  const W = Math.min(300, Dimensions.get('window').width - 64);
  const scale = W / 200; // Body ist intrinsisch 200 x 400 (mal scale)

  // Einheitlich getoente Figur; tippbare Muskeln mit etwas klarerer Kontur (dezenter Hinweis).
  const data: ExtendedBodyPart[] = CLICKABLE_SLUGS.map((slug) => {
    // Trizeps vorne: zaehlt zum Bizeps, bleibt aber unsichtbar (keine eigene Kontur).
    if (side === 'front' && slug === 'triceps') {
      return { slug, styles: { fill: c.muscle, stroke: c.muscle, strokeWidth: 1 } };
    }
    return { slug, styles: { fill: c.muscle, stroke: c.textMuted, strokeWidth: 1.25 } };
  });

  return (
    <View style={{ alignItems: 'center', width: '100%' }}>
      <View style={{ width: '100%', maxWidth: 300 }}>
        <Segmented
          options={[{ key: 'front', label: 'Vorderseite' }, { key: 'back', label: 'Rückseite' }]}
          value={side}
          onChange={(s) => setSide(s as 'front' | 'back')}
          c={c}
        />
      </View>

      <View style={{ marginTop: 18 }}>
        <Body
          side={side}
          gender={gender}
          scale={scale}
          data={data}
          colors={[c.muscle]}
          defaultFill={c.muscle}
          defaultStroke={c.border}
          defaultStrokeWidth={1}
          border={c.textMuted}
          onBodyPartPress={(b) => {
            const k = keyForSlug(b.slug, side);
            if (k) onSelect(k);
          }}
        />
      </View>

      <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 14, fontWeight: '600' }}>
        Tippe einen Muskel an
      </Text>
    </View>
  );
}
