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
// slug -> unser Key, aber SEITENABHAENGIG: auf der VORDERSEITE zaehlt der dort nur
// schmal sichtbare Trizeps zum Bizeps, damit der ganze vordere Oberarm leicht
// antippbar ist (auf der Rueckseite bleibt der Trizeps ein eigener Muskel).
function keyForSlug(slug: Slug | undefined, side: 'front' | 'back'): string | undefined {
  if (!slug) return undefined;
  if (side === 'front' && slug === 'triceps') return 'biceps';
  return SLUG_TO_KEY[slug];
}

// alle anklickbaren Slugs (fuer den dezenten Hinweis "hier kann man tippen")
const CLICKABLE_SLUGS = Object.keys(SLUG_TO_KEY) as Slug[];

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
  // Groessere Figur -> groessere Tippziele (v.a. schmale Muskeln wie Bizeps).
  const W = Math.min(300, Dimensions.get('window').width - 48);
  const scale = W / 200; // Body ist intrinsisch 200 x 400 (mal scale)

  // Muskeln werden NICHT eingefaerbt (kein sichtbares Klick-Highlight) - sie sehen
  // aus wie der restliche Koerper, sind aber durch eine sichtbare Kontur klar
  // voneinander getrennt, sodass man die einzelnen Muskeln gut erkennt.
  // Nur der aktuell GEWAEHLTE Muskel wird deutlich farbig hervorgehoben.
  const data: ExtendedBodyPart[] = CLICKABLE_SLUGS.map((slug) => {
    // hervorgehoben, wenn der (seitenabhaengige) Key dieses Muskels gewaehlt ist
    const sel = !!selectedKey && keyForSlug(slug, side) === selectedKey;
    // Trizeps auf der VORDERSEITE optisch ausblenden (gehoert dort zum Bizeps)
    const mergedFront = side === 'front' && slug === 'triceps';
    return {
      slug,
      styles: sel
        ? { fill: c.primary, stroke: c.accent, strokeWidth: 3 }
        : { fill: c.card, stroke: mergedFront ? c.card : c.textMuted, strokeWidth: 2 },
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
            const k = keyForSlug(b.slug, side);
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
