// Realistische anatomische Koerpergrafik mit hervorgehobenem Zielmuskel.
// Selbst/Offline (react-native-body-highlighter), keine Fotos, kein Lizenzrisiko.
import Body, { ExtendedBodyPart, Slug } from 'react-native-body-highlighter';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../contexts/ThemeContext';

const KEY_TO_SLUGS: Record<string, Slug[]> = {
  chest: ['chest'], biceps: ['biceps'], triceps: ['triceps'], shoulders: ['deltoids'],
  abs: ['abs', 'obliques'], back: ['trapezius', 'upper-back', 'lower-back'],
  legs: ['quadriceps', 'hamstring', 'adductors'], calves: ['calves'], glutes: ['gluteal'],
};
const SIDE: Record<string, 'front' | 'back'> = {
  chest: 'front', shoulders: 'front', biceps: 'front', abs: 'front', legs: 'front',
  back: 'back', triceps: 'back', glutes: 'back', calves: 'back',
};

export default function ExerciseFigure({
  muscleKey,
  c,
  width = 150,
}: {
  muscleKey?: string | null;
  c: Colors;
  width?: number;
}) {
  const { profile } = useAuth();
  const gender = profile?.gender === 'female' ? 'female' : 'male';

  if (!muscleKey || !KEY_TO_SLUGS[muscleKey]) return null;
  const side = SIDE[muscleKey] ?? 'front';
  const scale = width / 200;
  const data: ExtendedBodyPart[] = KEY_TO_SLUGS[muscleKey].map((slug) => ({
    slug,
    styles: { fill: c.primary, stroke: c.accent, strokeWidth: 4 },
  }));

  return (
    <Body
      side={side}
      gender={gender}
      scale={scale}
      data={data}
      defaultFill={c.muscle}
      defaultStroke={c.border}
      defaultStrokeWidth={2}
      border={c.textMuted}
    />
  );
}
