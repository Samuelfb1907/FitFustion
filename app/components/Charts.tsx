// Kleine Diagramme (Linie + Balken) auf Basis von react-native-svg.
// Bewusst simpel gehalten: keine Achsen-Beschriftung am Rand, dafuer leicht lesbar.
import Svg, { Polyline, Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { Colors } from '../contexts/ThemeContext';

// Sparkline / Liniendiagramm (z. B. Gewichtsverlauf)
// goal: optionale gestrichelte Ziellinie. showMinMax: kleine Min/Max-Beschriftung rechts.
export function LineChart({
  values,
  width,
  height,
  color,
  c,
  goal,
  showMinMax,
}: {
  values: number[];
  width: number;
  height: number;
  color: string;
  c: Colors;
  goal?: number | null;
  showMinMax?: boolean;
}) {
  const padL = 6;
  const padR = showMinMax ? 30 : 6;
  const padT = 12;
  const padB = 10;
  const innerW = Math.max(1, width - padL - padR);
  const innerH = Math.max(1, height - padT - padB);
  const n = values.length;
  const lo = Math.min(...values, goal != null ? goal : Infinity);
  const hi = Math.max(...values, goal != null ? goal : -Infinity);
  const min = isFinite(lo) ? lo : 0;
  const max = isFinite(hi) ? hi : 1;
  const range = max - min || 1;

  const xFor = (i: number) => padL + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const yFor = (v: number) => padT + innerH - ((v - min) / range) * innerH;
  const pts = values.map((v, i) => `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(' ');

  return (
    <Svg width={width} height={height}>
      {/* Grundlinie */}
      <Line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke={c.border} strokeWidth={1} />
      {/* Ziellinie */}
      {goal != null && (
        <Line x1={padL} y1={yFor(goal)} x2={padL + innerW} y2={yFor(goal)} stroke={c.success} strokeWidth={1.5} strokeDasharray="5,4" opacity={0.85} />
      )}
      {n > 1 && <Polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />}
      {values.map((v, i) => (
        <Circle key={i} cx={xFor(i)} cy={yFor(v)} r={i === n - 1 ? 4.5 : 2.5} fill={color} />
      ))}
      {showMinMax && (
        <>
          <SvgText x={padL + innerW + 4} y={padT + 4} fontSize={9} fill={c.textMuted}>{Math.round(max)}</SvgText>
          <SvgText x={padL + innerW + 4} y={padT + innerH} fontSize={9} fill={c.textMuted}>{Math.round(min)}</SvgText>
        </>
      )}
    </Svg>
  );
}

// Balkendiagramm (z. B. Trainingsvolumen je Woche)
export function BarChart({
  values,
  labels,
  width,
  height,
  color,
  c,
}: {
  values: number[];
  labels: string[];
  width: number;
  height: number;
  color: string;
  c: Colors;
}) {
  const padT = 8;
  const padB = 18;
  const innerH = Math.max(1, height - padT - padB);
  const n = values.length;
  const max = Math.max(...values, 1);
  const gap = 6;
  const barW = n > 0 ? Math.max(2, (width - gap * (n - 1)) / n) : width;

  return (
    <Svg width={width} height={height}>
      {values.map((v, i) => {
        const bh = (v / max) * innerH;
        const x = i * (barW + gap);
        const y = padT + innerH - bh;
        return <Rect key={i} x={x} y={y} width={barW} height={Math.max(1, bh)} rx={3} fill={v > 0 ? color : c.border} />;
      })}
      {labels.map((lab, i) => (
        <SvgText
          key={i}
          x={i * (barW + gap) + barW / 2}
          y={height - 4}
          fontSize={9}
          fill={c.textMuted}
          textAnchor="middle"
        >
          {lab}
        </SvgText>
      ))}
    </Svg>
  );
}
