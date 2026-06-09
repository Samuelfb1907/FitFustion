// Pausen-Timer zwischen den Saetzen. Voreingestellte Laengen, Start/Pause/Reset,
// Countdown + Fortschrittsbalken, Vibration wenn die Pause vorbei ist.
// autoStartSignal: aendert sich der Wert (z. B. nach einem Satz-Eintrag), startet der Timer frisch.
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import { Colors } from '../contexts/ThemeContext';
import GlassFill from './GlassFill';

const PRESETS = [60, 90, 120, 180];
const fmtPreset = (s: number) => (s % 60 === 0 ? `${s / 60} min` : `${s} s`);

export default function RestTimer({ c, autoStartSignal, defaultSeconds = 90 }: { c: Colors; autoStartSignal?: number; defaultSeconds?: number }) {
  const styles = makeStyles(c);
  const [duration, setDuration] = useState(defaultSeconds);
  const [remaining, setRemaining] = useState(defaultSeconds);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTimer() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }
  function start(secs?: number) {
    const d = secs ?? duration;
    clearTimer();
    setDuration(d);
    setRemaining(d);
    setDone(false);
    setRunning(true);
  }
  function resume() { setDone(false); setRunning(true); }
  function pause() { setRunning(false); clearTimer(); }
  function reset() { pause(); setRemaining(duration); setDone(false); }

  // Sekunden-Tick, laeuft nur solange running === true
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearTimer();
          setRunning(false);
          setDone(true);
          try { Vibration.vibrate(Platform.OS === 'android' ? [0, 300, 150, 300] : 600); } catch {}
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return clearTimer;
  }, [running]);

  // Auto-Start von aussen (z. B. nach einem gespeicherten Satz)
  useEffect(() => {
    if (autoStartSignal && autoStartSignal > 0) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartSignal]);

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const label = `${mm}:${String(ss).padStart(2, '0')}`;
  const progress = duration > 0 ? remaining / duration : 0;
  const paused = !running && !done && remaining > 0 && remaining < duration;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>⏱️ Pausen-Timer</Text>

      <View style={styles.presets}>
        {PRESETS.map((p) => (
          <TouchableOpacity key={p} style={[styles.preset, duration === p && styles.presetActive]} onPress={() => start(p)} activeOpacity={0.8}>
            <GlassFill radius={10} />
            <Text style={[styles.presetText, duration === p && styles.presetTextActive]}>{fmtPreset(p)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.time, done && { color: c.success }]}>{done ? 'Pause vorbei! 💪' : label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: done ? c.success : c.primary }]} />
      </View>

      <View style={styles.btns}>
        {running ? (
          <TouchableOpacity style={styles.btn} onPress={pause} activeOpacity={0.85}><Text style={styles.btnText}>⏸  Pause</Text></TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btn} onPress={() => (paused ? resume() : start())} activeOpacity={0.85}>
            <Text style={styles.btnText}>{paused ? '▶  Weiter' : '▶  Start'}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.btnGhost} onPress={reset} activeOpacity={0.85}><GlassFill radius={10} /><Text style={styles.btnGhostText}>↺  Reset</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    wrap: { marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: c.inputBg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    title: { fontSize: 15, fontWeight: '700', color: c.heading, marginBottom: 10 },
    presets: { flexDirection: 'row', gap: 8 },
    preset: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    presetActive: { backgroundColor: c.primary, borderColor: c.primary },
    presetText: { fontSize: 13, fontWeight: '700', color: c.text },
    presetTextActive: { color: c.onPrimary },
    time: { fontSize: 42, fontWeight: '800', color: c.heading, textAlign: 'center', marginTop: 12, fontVariant: ['tabular-nums'] },
    track: { height: 8, backgroundColor: c.track, borderRadius: 4, overflow: 'hidden', marginTop: 8 },
    fill: { height: 8, borderRadius: 4 },
    btns: { flexDirection: 'row', gap: 10, marginTop: 14 },
    btn: { flex: 1, backgroundColor: c.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    btnText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
    btnGhost: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: c.card },
    btnGhostText: { color: c.textMuted, fontSize: 15, fontWeight: '700' },
  });
}
