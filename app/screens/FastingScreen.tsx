// Intervallfasten-Timer (#2). Eingebettet als Reiter im Essen-Hub. Zeigt das laufende
// Fasten (Live-Countdown + Fortschritt zum Ziel), sonst die Ziel-Auswahl zum Starten.
// Streak = aufeinanderfolgende Tage mit geschafftem Fasten. Datenquelle: lib/fasting.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import GlassFill from '../components/GlassFill';
import { CARD_SHADOW as shadow } from '../lib/ui';
import { TAB_BAR_SPACE } from '../lib/layout';
import { Fast, loadFasting, startFast, endFast } from '../lib/fasting';
import { hTap, hSuccess } from '../lib/haptics';

const TARGETS = [16, 18, 20];

function hms(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function FastingScreen({ focusTick }: { focusTick?: number }) {
  const { session } = useAuth();
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [active, setActive] = useState<Fast | null>(null);
  const [streak, setStreak] = useState(0);
  const [recent, setRecent] = useState<Fast[]>([]);
  const [target, setTarget] = useState(16);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { load(); }, [session?.user?.id]);
  useEffect(() => { if (focusTick) load(); }, [focusTick]);

  // Live-Ticker nur, solange ein Fasten laeuft.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active?.id]);

  async function load() {
    const uid = session?.user?.id;
    if (!uid) { setLoading(false); return; }
    try {
      const r = await loadFasting(uid);
      setActive(r.active); setStreak(r.streak); setRecent(r.recent);
    } catch {}
    setLoading(false);
  }

  async function start() {
    const uid = session?.user?.id;
    if (!uid || busy) return;
    setBusy(true); hTap();
    const f = await startFast(uid, target);
    setBusy(false);
    if (f) { setActive(f); setNow(Date.now()); }
  }

  async function stop() {
    if (!active || busy) return;
    const reached = Date.now() - new Date(active.started_at).getTime() >= active.target_hours * 3600000;
    setBusy(true);
    await endFast(active.id);
    setBusy(false);
    if (reached) hSuccess();
    setActive(null);
    load();
  }

  if (loading) return <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} />;

  const elapsedMs = active ? now - new Date(active.started_at).getTime() : 0;
  const targetMs = active ? active.target_hours * 3600000 : 0;
  const pct = active ? Math.min(1, elapsedMs / targetMs) : 0;
  const done = !!active && elapsedMs >= targetMs;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }} showsVerticalScrollIndicator={false}>
      {streak > 0 && (
        <View style={styles.streakPill}>
          <Ionicons name="flame" size={16} color="#F0B429" />
          <Text style={styles.streakText}>{t('fasting.streak', { n: streak })}</Text>
        </View>
      )}

      {active ? (
        <View style={styles.timerCard}>
          <GlassFill radius={22} />
          <Text style={styles.phase}>{done ? t('fasting.reached') : t('fasting.fasting')}</Text>
          <Text style={styles.time}>{hms(elapsedMs)}</Text>
          <Text style={styles.targetLine}>{t('fasting.ofTarget', { h: active.target_hours })}</Text>
          <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: done ? '#19C98F' : c.primary }]} /></View>
          <TouchableOpacity style={styles.stopBtn} onPress={stop} disabled={busy} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('fasting.stop')}>
            {busy ? <ActivityIndicator color={c.danger} /> : <Text style={styles.stopText}>{t('fasting.stop')}</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.startCard}>
          <GlassFill radius={22} />
          <Text style={styles.startIcon}>⏳</Text>
          <Text style={styles.startTitle}>{t('fasting.startTitle')}</Text>
          <Text style={styles.startSub}>{t('fasting.startSub')}</Text>
          <View style={styles.targetRow}>
            {TARGETS.map((h) => (
              <TouchableOpacity key={h} style={[styles.targetChip, target === h && styles.targetChipOn]} onPress={() => setTarget(h)} activeOpacity={0.85}>
                <Text style={[styles.targetChipText, target === h && styles.targetChipTextOn]}>{h}:{24 - h}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.startBtn} onPress={start} disabled={busy} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('fasting.start')}>
            {busy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.startBtnText}>{t('fasting.start')}</Text>}
          </TouchableOpacity>
        </View>
      )}

      {recent.length > 0 && (
        <View style={styles.histCard}>
          <GlassFill radius={16} />
          <Text style={styles.histLabel}>{t('fasting.history')}</Text>
          {recent.map((r, i) => {
            const dur = (new Date(r.ended_at!).getTime() - new Date(r.started_at).getTime()) / 3600000;
            const ok = dur >= r.target_hours;
            return (
              <View key={r.id} style={[styles.histRow, i > 0 && styles.histDivider]}>
                <Ionicons name={ok ? 'checkmark-circle' : 'close-circle-outline'} size={18} color={ok ? c.primary : c.textMuted} />
                <Text style={styles.histDate}>{String(r.ended_at).slice(8, 10)}.{String(r.ended_at).slice(5, 7)}.</Text>
                <Text style={styles.histDur}>{dur.toFixed(1)} h / {r.target_hours} h</Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    streakPill: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, backgroundColor: c.card, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: c.cardBorder, marginBottom: 4 },
    streakText: { fontSize: 14, fontWeight: '800', color: c.heading },

    timerCard: { ...shadow, backgroundColor: c.card, borderRadius: 22, padding: 24, marginTop: 12, borderWidth: 1, borderColor: c.cardBorder, alignItems: 'center', overflow: 'hidden' },
    phase: { fontSize: 12, fontWeight: '800', letterSpacing: 1.6, color: c.textMuted },
    time: { fontSize: 52, fontWeight: '900', color: c.heading, letterSpacing: -1, marginTop: 6, fontVariant: ['tabular-nums'] },
    targetLine: { fontSize: 14, color: c.textMuted, marginTop: 2 },
    barTrack: { alignSelf: 'stretch', height: 8, borderRadius: 4, backgroundColor: c.track, overflow: 'hidden', marginTop: 18 },
    barFill: { height: 8, borderRadius: 4 },
    stopBtn: { alignSelf: 'stretch', borderRadius: 16, paddingVertical: 15, alignItems: 'center', borderWidth: 1.5, borderColor: c.danger, marginTop: 18 },
    stopText: { color: c.danger, fontSize: 16, fontWeight: '800' },

    startCard: { ...shadow, backgroundColor: c.card, borderRadius: 22, padding: 24, marginTop: 12, borderWidth: 1, borderColor: c.cardBorder, alignItems: 'center', overflow: 'hidden' },
    startIcon: { fontSize: 40, marginBottom: 6 },
    startTitle: { fontSize: 20, fontWeight: '800', color: c.heading, textAlign: 'center' },
    startSub: { fontSize: 14, color: c.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
    targetRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
    targetChip: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.inputBg },
    targetChipOn: { borderColor: c.primary, backgroundColor: 'rgba(25,201,143,0.12)' },
    targetChipText: { fontSize: 16, fontWeight: '800', color: c.textMuted },
    targetChipTextOn: { color: c.primary },
    startBtn: { alignSelf: 'stretch', backgroundColor: c.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
    startBtnText: { color: c.onPrimary, fontSize: 16, fontWeight: '800' },

    histCard: { ...shadow, backgroundColor: c.card, borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    histLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: c.textMuted, marginBottom: 4 },
    histRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
    histDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    histDate: { fontSize: 14, fontWeight: '700', color: c.text, width: 56 },
    histDur: { fontSize: 14, color: c.textMuted, flex: 1 },
  });
}
