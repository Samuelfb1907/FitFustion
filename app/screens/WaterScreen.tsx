// Eigener Wasser-Tracker (Reiter unter "Essen"), Bento-Stil. Liest/schreibt water_logs.
import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useFocusTick } from '../lib/useFocusTick';
import ErrorRetry from '../components/ErrorRetry';
import { errorMessage } from '../lib/errors';
import { todayStr } from '../lib/date';
import { CARD_SHADOW as shadow } from '../lib/ui';
import { WATER_GOAL, GLASS } from '../lib/water';

type WaterRow = { id: string; amount_ml: number; created_at: string };

// todayStr -> lib/date.ts, WATER_GOAL/GLASS -> lib/water.ts
function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function WaterScreen({ embedded, focusTick }: { embedded?: boolean; focusTick?: number }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const c = useColors();
  const styles = makeStyles(c);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<WaterRow[]>([]);

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
    if (!userId) return;
    const { error: e } = await supabase.from('water_logs').insert({ user_id: userId, amount_ml: ml, log_date: todayStr() });
    if (e) { setError(errorMessage(e)); return; }
    await load(true);
  }
  async function removeOne(id: string) {
    const { error: e } = await supabase.from('water_logs').delete().eq('id', id);
    if (e) { setError(errorMessage(e)); return; }
    await load(true);
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
        {!embedded && <Text style={styles.title}>Wasser</Text>}
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, embedded && styles.embedded]}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
    >
      {!embedded && <Text style={styles.title}>Wasser</Text>}

      {error ? (
        <ErrorRetry message={error} onRetry={() => load()} embedded={embedded} />
      ) : (
        <View style={styles.grid}>
          {/* HERO-KACHEL */}
          <View style={styles.heroTile}>
            <Text style={styles.bigMl}>{total}<Text style={styles.bigUnit}> ml</Text></Text>
            <Text style={styles.goalLine}>Ziel: {WATER_GOAL} ml{reached ? '  ·  erreicht 🎉' : ''}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%` }]} />
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{pct}%</Text>
              <Text style={styles.meta}>{reached ? 'Geschafft!' : `noch ${remaining} ml`}</Text>
              <Text style={styles.meta}>≈ {glasses} Gläser</Text>
            </View>
          </View>

          {/* ADD-KACHELN */}
          <View style={styles.row}>
            <TouchableOpacity style={styles.addTile} onPress={() => add(250)} activeOpacity={0.85}>
              <Text style={styles.addEmoji}>💧</Text><Text style={styles.addText}>+250 ml</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addTile} onPress={() => add(500)} activeOpacity={0.85}>
              <Text style={styles.addEmoji}>💦</Text><Text style={styles.addText}>+500 ml</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addTile} onPress={() => add(750)} activeOpacity={0.85}>
              <Text style={styles.addEmoji}>🚰</Text><Text style={styles.addText}>+750 ml</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.undoBtn} onPress={undoLast} activeOpacity={0.85} disabled={!rows.length}>
            <Text style={[styles.undoText, !rows.length && { opacity: 0.4 }]}>↩  Letzten Eintrag rückgängig</Text>
          </TouchableOpacity>

          {/* HEUTE GETRUNKEN */}
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>HEUTE GETRUNKEN</Text>
            {rows.length === 0 ? (
              <Text style={styles.empty}>Noch nichts getrunken. Trink ein Glas! 💧</Text>
            ) : (
              [...rows].reverse().map((r, idx) => (
                <View key={r.id} style={[styles.entry, idx > 0 && styles.entryDivider]}>
                  <Text style={styles.rowTime}>{hhmm(r.created_at)}</Text>
                  <Text style={styles.rowMl}>+{r.amount_ml} ml</Text>
                  <TouchableOpacity onPress={() => removeOne(r.id)} style={styles.del} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={`Wasser-Eintrag ${r.amount_ml} ml entfernen`}><Text style={styles.delText}>✕</Text></TouchableOpacity>
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
    title: { fontSize: 26, fontWeight: '800', color: c.heading, marginBottom: 14 },

    grid: { gap: 12 },
    row: { flexDirection: 'row', gap: 10 },

    heroTile: { ...shadow, backgroundColor: c.card, borderRadius: 16, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: c.cardBorder },
    bigMl: { fontSize: 40, fontWeight: '800', color: c.primary },
    bigUnit: { fontSize: 22, fontWeight: '700', color: c.textMuted },
    goalLine: { fontSize: 14, color: c.textMuted, marginTop: 2, marginBottom: 16 },
    track: { width: '100%', height: 14, backgroundColor: c.track, borderRadius: 7, overflow: 'hidden' },
    fill: { height: 14, backgroundColor: c.primary, borderRadius: 7 },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 12 },
    meta: { fontSize: 13, color: c.textMuted, fontWeight: '600' },

    addTile: { ...shadow, flex: 1, backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
    addEmoji: { fontSize: 22 },
    addText: { color: c.primary, fontWeight: '700', fontSize: 14, marginTop: 4 },
    undoBtn: { paddingVertical: 13, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.cardBorder },
    undoText: { color: c.textMuted, fontSize: 14, fontWeight: '700' },

    tile: { ...shadow, backgroundColor: c.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: c.cardBorder },
    tileLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: c.textMuted, marginBottom: 6 },
    empty: { fontSize: 14, color: c.textMuted, fontStyle: 'italic', marginTop: 6, textAlign: 'center' },
    entry: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
    entryDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    rowTime: { fontSize: 14, color: c.textMuted, width: 56 },
    rowMl: { flex: 1, fontSize: 16, color: c.heading, fontWeight: '700' },
    del: { padding: 6 },
    delText: { fontSize: 15, color: c.textMuted },
  });
}
