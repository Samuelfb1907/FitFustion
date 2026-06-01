// Eigener Wasser-Tracker (Reiter unter "Essen"). Liest/schreibt water_logs.
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';

type WaterRow = { id: string; amount_ml: number; created_at: string };

const WATER_GOAL = 2500; // Tagesziel in ml
const GLASS = 250;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function WaterScreen({ embedded }: { embedded?: boolean }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const c = useColors();
  const styles = makeStyles(c);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<WaterRow[]>([]);

  useEffect(() => { load(); }, [userId]);

  async function load() {
    if (!userId) { setLoading(false); return; }
    const { data } = await supabase
      .from('water_logs').select('id, amount_ml, created_at')
      .eq('user_id', userId).eq('log_date', todayStr()).order('created_at');
    setRows((data ?? []) as WaterRow[]);
    setLoading(false);
  }

  async function add(ml: number) {
    if (!userId) return;
    await supabase.from('water_logs').insert({ user_id: userId, amount_ml: ml, log_date: todayStr() });
    await load();
  }
  async function removeOne(id: string) {
    await supabase.from('water_logs').delete().eq('id', id);
    await load();
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
    <ScrollView style={[styles.container, embedded && styles.embedded]} contentContainerStyle={{ paddingBottom: 40 }}>
      {!embedded && <Text style={styles.title}>Wasser</Text>}

      <View style={styles.hero}>
        <Text style={styles.bigMl}>{total} <Text style={styles.bigUnit}>ml</Text></Text>
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

      <View style={styles.btnGrid}>
        <TouchableOpacity style={styles.addBtn} onPress={() => add(250)} activeOpacity={0.85}>
          <Text style={styles.addEmoji}>🥛</Text><Text style={styles.addText}>+250 ml</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={() => add(500)} activeOpacity={0.85}>
          <Text style={styles.addEmoji}>🍶</Text><Text style={styles.addText}>+500 ml</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={() => add(750)} activeOpacity={0.85}>
          <Text style={styles.addEmoji}>🚰</Text><Text style={styles.addText}>+750 ml</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.undoBtn} onPress={undoLast} activeOpacity={0.85} disabled={!rows.length}>
        <Text style={[styles.undoText, !rows.length && { opacity: 0.4 }]}>↩  Letzten Eintrag rückgängig</Text>
      </TouchableOpacity>

      <Text style={styles.section}>HEUTE GETRUNKEN</Text>
      {rows.length === 0 ? (
        <Text style={styles.empty}>Noch nichts getrunken. Trink ein Glas! 💧</Text>
      ) : (
        [...rows].reverse().map((r) => (
          <View key={r.id} style={styles.row}>
            <Text style={styles.rowTime}>{hhmm(r.created_at)}</Text>
            <Text style={styles.rowMl}>+{r.amount_ml} ml</Text>
            <TouchableOpacity onPress={() => removeOne(r.id)} style={styles.del}><Text style={styles.delText}>✕</Text></TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 60, paddingHorizontal: 20 },
    embedded: { paddingTop: 8, paddingHorizontal: 0, backgroundColor: 'transparent' },
    title: { fontSize: 26, fontWeight: 'bold', color: c.heading, marginBottom: 12 },

    hero: { backgroundColor: c.card, borderRadius: 18, padding: 22, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    bigMl: { fontSize: 46, fontWeight: '800', color: c.primary },
    bigUnit: { fontSize: 22, fontWeight: '700', color: c.textMuted },
    goalLine: { fontSize: 14, color: c.textMuted, marginTop: 2, marginBottom: 16 },
    track: { width: '100%', height: 14, backgroundColor: c.track, borderRadius: 7, overflow: 'hidden' },
    fill: { height: 14, backgroundColor: c.primary, borderRadius: 7 },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10 },
    meta: { fontSize: 13, color: c.textMuted, fontWeight: '600' },

    btnGrid: { flexDirection: 'row', gap: 10, marginTop: 18 },
    addBtn: { flex: 1, backgroundColor: c.card, borderWidth: 1, borderColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    addEmoji: { fontSize: 22 },
    addText: { color: c.primary, fontWeight: '700', fontSize: 14, marginTop: 4 },
    undoBtn: { marginTop: 12, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.border },
    undoText: { color: c.textMuted, fontSize: 14, fontWeight: '700' },

    section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: c.textMuted, marginTop: 22, marginBottom: 8, marginLeft: 4 },
    empty: { fontSize: 14, color: c.textMuted, fontStyle: 'italic', marginTop: 6, textAlign: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    rowTime: { fontSize: 14, color: c.textMuted, width: 56 },
    rowMl: { flex: 1, fontSize: 16, color: c.heading, fontWeight: '700' },
    del: { padding: 6 },
    delText: { fontSize: 15, color: c.textMuted },
  });
}
