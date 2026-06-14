// Eigener Wasser-Tracker (Reiter unter "Essen"), Bento-Stil. Liest/schreibt water_logs.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusTick } from '../lib/useFocusTick';
import ErrorRetry from '../components/ErrorRetry';
import GlassFill from '../components/GlassFill';
import { errorMessage } from '../lib/errors';
import { todayStr } from '../lib/date';
import { CARD_SHADOW as shadow } from '../lib/ui';
import { WATER_GOAL, GLASS } from '../lib/water';

type WaterRow = { id: string; amount_ml: number; created_at: string };

// Wasser-Akzent (wie Home-Kachel) + getoenter Chip-Hintergrund.
const WATER = '#3FA9F5';
const WATER_TINT = 'rgba(63,169,245,0.12)';

// todayStr -> lib/date.ts, WATER_GOAL/GLASS -> lib/water.ts
function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function WaterScreen({ embedded, focusTick }: { embedded?: boolean; focusTick?: number }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<WaterRow[]>([]);
  const busyRef = useRef(false); // verhindert doppelte Eintraege bei schnellem Doppel-Tippen

  useEffect(() => { load(); }, [userId]);

  // Reiter erneut angetippt -> leise aktualisieren (ohne Spinner)
  useFocusTick(focusTick, () => { load(true); });

  async function fetchRows() {
    if (!userId) return;
    const { data, error: e } = await supabase
      .from('water_logs').select('id, amount_ml, created_at')
      .eq('user_id', userId).eq('log_date', todayStr()).order('created_at');
    if (e) throw e;
    setRows((data ?? []) as WaterRow[]);
  }

  async function load(silent = false) {
    if (!userId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      await fetchRows();
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    load(true);
  }

  async function add(ml: number) {
    if (!userId || busyRef.current) return;
    busyRef.current = true;
    try {
      const { error: e } = await supabase.from('water_logs').insert({ user_id: userId, amount_ml: ml, log_date: todayStr() });
      if (e) { setError(errorMessage(e)); return; }
      await load(true);
    } finally {
      busyRef.current = false;
    }
  }
  async function removeOne(id: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const { error: e } = await supabase.from('water_logs').delete().eq('id', id);
      if (e) { setError(errorMessage(e)); return; }
      await load(true);
    } finally {
      busyRef.current = false;
    }
  }
  async function undoLast() {
    if (!rows.length) return;
    await removeOne(rows[rows.length - 1].id);
  }

  const total = rows.reduce((s, r) => s + (r.amount_ml ?? 0), 0);
  const pct = Math.min(100, Math.round((total / WATER_GOAL) * 100));
  const glasses = Math.round((total / GLASS) * 10) / 10;
  const remaining = Math.max(0, WATER_GOAL - total);
  const reached = total >= WATER_GOAL;

  if (loading) {
    return (
      <View style={[styles.container, embedded && styles.embedded]}>
        {!embedded && <Text style={styles.title}>{t('water.title')}</Text>}
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, embedded && styles.embedded, embedded && styles.bleed]}
      contentContainerStyle={[{ paddingBottom: 24 }, embedded && styles.bleedPad]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
    >
      {!embedded && <Text style={styles.title}>{t('water.title')}</Text>}

      {error ? (
        <ErrorRetry message={error} onRetry={() => load()} embedded={embedded} />
      ) : (
        <View style={styles.grid}>
          {/* HERO-KACHEL: Icon-Chip + Eyebrow + Prozent-Pille, grosse Zahl, Fortschritt */}
          <View style={styles.heroTile}>
            <GlassFill radius={22} />
            <View style={styles.heroHead}>
              <View style={styles.heroChip}>
                <Ionicons name="water" size={19} color={WATER} />
              </View>
              <Text style={styles.heroEyebrow} numberOfLines={1}>{t('water.title').toUpperCase()}</Text>
              <View style={styles.pctPill}>
                {reached && <Ionicons name="checkmark-circle" size={13} color={WATER} />}
                <Text style={styles.pctPillText} numberOfLines={1}>{pct}%</Text>
              </View>
            </View>
            <Text style={styles.bigMl} numberOfLines={1}>{total}<Text style={styles.bigUnit}> ml</Text></Text>
            <Text style={styles.goalLine} numberOfLines={1}>{t('water.goal', { n: WATER_GOAL })}{reached ? t('water.goalReachedSuffix') : ''}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%` }]} />
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.meta} numberOfLines={1}>{reached ? t('water.done') : t('water.remaining', { n: remaining })}</Text>
              <Text style={styles.meta} numberOfLines={1}>{t('water.glasses', { n: glasses })}</Text>
            </View>
          </View>

          {/* ADD-KACHELN */}
          <View style={styles.row}>
            <TouchableOpacity style={styles.addTile} onPress={() => add(250)} activeOpacity={0.85} accessibilityRole="button">
              <GlassFill radius={16} />
              <View style={styles.addChip}><Ionicons name="water-outline" size={18} color={WATER} /></View>
              <Text style={styles.addText} numberOfLines={1}>{t('water.add', { n: 250 })}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addTile} onPress={() => add(500)} activeOpacity={0.85} accessibilityRole="button">
              <GlassFill radius={16} />
              <View style={styles.addChip}><Ionicons name="water" size={18} color={WATER} /></View>
              <Text style={styles.addText} numberOfLines={1}>{t('water.add', { n: 500 })}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addTile} onPress={() => add(750)} activeOpacity={0.85} accessibilityRole="button">
              <GlassFill radius={16} />
              <View style={styles.addChip}><Ionicons name="pint-outline" size={18} color={WATER} /></View>
              <Text style={styles.addText} numberOfLines={1}>{t('water.add', { n: 750 })}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.undoBtn} onPress={undoLast} activeOpacity={0.85} disabled={!rows.length} accessibilityRole="button">
            <View style={[styles.undoInner, !rows.length && { opacity: 0.4 }]}>
              <Ionicons name="arrow-undo-outline" size={15} color={c.textMuted} />
              <Text style={styles.undoText} numberOfLines={1}>{t('water.undoLast')}</Text>
            </View>
          </TouchableOpacity>

          {/* HEUTE GETRUNKEN */}
          <View style={styles.tile}>
            <GlassFill radius={20} />
            <Text style={styles.tileLabel}>{t('water.todayLabel')}</Text>
            {rows.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="water-outline" size={22} color={c.textMuted} style={{ opacity: 0.6 }} />
                <Text style={styles.empty}>{t('water.empty')}</Text>
              </View>
            ) : (
              [...rows].reverse().map((r, idx) => (
                <View key={r.id} style={[styles.entry, idx > 0 && styles.entryDivider]}>
                  <Text style={styles.rowTime} numberOfLines={1}>{hhmm(r.created_at)}</Text>
                  <Text style={styles.rowMl} numberOfLines={1}>{t('water.entryAmount', { n: r.amount_ml })}</Text>
                  <TouchableOpacity onPress={() => removeOne(r.id)} style={styles.del} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('water.removeEntryA11y', { n: r.amount_ml })}>
                    <Ionicons name="close" size={16} color={c.textMuted} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 56, paddingHorizontal: 16 },
    embedded: { paddingTop: 4, paddingHorizontal: 0, backgroundColor: 'transparent' },
    // Eingebettet im Essen-Hub (20px Seitenrand): Liste bis zum echten Bildschirmrand
    // ziehen -> Scroll-Balken sitzt rechts am Rand; Inhalt bleibt per bleedPad eingerueckt.
    bleed: { marginHorizontal: -20 },
    bleedPad: { paddingHorizontal: 20 },
    title: { fontSize: 26, fontWeight: '800', color: c.heading, marginBottom: 14 },

    grid: { gap: 12 },
    row: { flexDirection: 'row', gap: 10 },

    // Hero (Icon-Chip + Eyebrow oben, grosse Zahl + Balken darunter)
    heroTile: { ...shadow, backgroundColor: c.card, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    heroHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    heroChip: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: WATER_TINT },
    heroEyebrow: { flex: 1, fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: c.textMuted },
    pctPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(63,169,245,0.30)', backgroundColor: WATER_TINT },
    pctPillText: { fontSize: 11, fontWeight: '700', color: WATER },
    bigMl: { fontSize: 38, fontWeight: '800', color: c.heading, letterSpacing: -0.3, marginTop: 16 },
    bigUnit: { fontSize: 20, fontWeight: '700', color: c.textMuted, letterSpacing: 0 },
    goalLine: { fontSize: 13, color: c.textMuted, fontWeight: '500', marginTop: 7, marginBottom: 14 },
    track: { width: '100%', height: 10, backgroundColor: c.track, borderRadius: 999, overflow: 'hidden' },
    fill: { height: 10, backgroundColor: WATER, borderRadius: 999 },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10 },
    meta: { fontSize: 13, color: c.textMuted, fontWeight: '600' },

    // Schnell-Knoepfe (+250/+500/+750) und Undo
    addTile: { ...shadow, flex: 1, backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, borderRadius: 16, paddingVertical: 14, alignItems: 'center', gap: 7, overflow: 'hidden' },
    addChip: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: WATER_TINT },
    addText: { color: WATER, fontWeight: '700', fontSize: 14 },
    undoBtn: { paddingVertical: 13, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: c.cardBorder },
    undoInner: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    undoText: { color: c.textMuted, fontSize: 14, fontWeight: '700' },

    // Tages-Log
    tile: { ...shadow, backgroundColor: c.card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    tileLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: c.textMuted, marginBottom: 6 },
    emptyWrap: { alignItems: 'center', gap: 8, paddingVertical: 12 },
    empty: { fontSize: 14, color: c.textMuted, fontWeight: '500', textAlign: 'center' },
    entry: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
    entryDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    rowTime: { fontSize: 14, color: c.textMuted, width: 56 },
    rowMl: { flex: 1, fontSize: 16, color: c.heading, fontWeight: '700' },
    del: { padding: 6 },
  });
}
