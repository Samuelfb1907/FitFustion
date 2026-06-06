// Bestenliste (opt-in, datenschutzfreundlich): Rangliste nach aktiven Ziel-Tagen
// (getrackt ODER trainiert) - umschaltbar Woche/Monat. Eigene Zeile hervorgehoben.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import Segmented from '../components/Segmented';
import ErrorRetry from '../components/ErrorRetry';
import { errorMessage } from '../lib/errors';
import { CARD_SHADOW as shadow } from '../lib/ui';
import { LeaderRow, getMyEntry, joinLeaderboard, refreshMyScores, leaveLeaderboard, fetchBoard, effectiveScore } from '../lib/leaderboard';

function medal(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
}

export default function LeaderboardScreen({ embedded }: { embedded?: boolean }) {
  const { session, profile } = useAuth();
  const userId = session?.user?.id;
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [optedIn, setOptedIn] = useState(false);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [nameInput, setNameInput] = useState('');
  const [busy, setBusy] = useState(false);

  const defaultName = (profile?.first_name ?? '').trim() || 'Anonym';

  useEffect(() => { init(); }, [userId]);

  async function init(silent = false) {
    if (!userId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const mine = await getMyEntry(userId);
      setOptedIn(!!mine);
      if (mine) await refreshMyScores(userId);
      setBoard(await fetchBoard());
      setErr(null);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() { setRefreshing(true); init(true); }

  async function join() {
    if (!userId) return;
    const name = (nameInput.trim() || defaultName).slice(0, 24);
    setBusy(true);
    const e = await joinLeaderboard(userId, name);
    setBusy(false);
    if (e) { setErr(errorMessage(e)); return; }
    setNameInput('');
    await init(true);
  }

  function confirmLeave() {
    Alert.alert(
      'Nicht mehr teilnehmen?',
      'Dein Eintrag wird aus der Bestenliste entfernt und du bist wieder privat. Du kannst jederzeit erneut teilnehmen.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Entfernen', style: 'destructive', onPress: doLeave },
      ],
    );
  }
  async function doLeave() {
    if (!userId) return;
    setBusy(true);
    const e = await leaveLeaderboard(userId);
    setBusy(false);
    if (e) { setErr(errorMessage(e)); return; }
    await init(true);
  }

  if (loading) {
    return (
      <View style={[styles.container, embedded && styles.embedded]}>
        {!embedded && <Text style={styles.title}>Bestenliste</Text>}
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (err) {
    return (
      <View style={[styles.container, embedded && styles.embedded]}>
        {!embedded && <Text style={styles.title}>Bestenliste</Text>}
        <ErrorRetry message={err} onRetry={() => init()} embedded={embedded} />
      </View>
    );
  }

  // Opt-in-Ansicht
  if (!optedIn) {
    return (
      <ScrollView style={[styles.container, embedded && styles.embedded]} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {!embedded && <Text style={styles.title}>Bestenliste</Text>}
        <View style={styles.tile}>
          <Text style={styles.joinIcon}>🏆</Text>
          <Text style={styles.joinTitle}>Mach mit beim Wettbewerb!</Text>
          <Text style={styles.joinText}>
            Miss dich mit anderen: Wer schafft an den meisten Tagen sein Ziel? Es zählt jeder Tag, an dem du etwas{' '}
            <Text style={{ fontWeight: '700', color: c.text }}>getrackt oder trainiert</Text> hast – pro Woche und pro Monat.
          </Text>
          <View style={styles.privacy}>
            <Text style={styles.privacyText}>
              🔒 Freiwillig & privat-freundlich: Es wird nur dein gewählter Anzeigename und die Anzahl deiner aktiven Tage gezeigt. Du kannst jederzeit wieder aussteigen.
            </Text>
          </View>
          <Text style={styles.label}>Dein Anzeigename</Text>
          <TextInput
            style={styles.input}
            value={nameInput}
            onChangeText={setNameInput}
            placeholder={defaultName}
            placeholderTextColor={c.textMuted}
            maxLength={24}
            autoCapitalize="words"
            underlineColorAndroid="transparent"
          />
          <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={join} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.primaryText}>Am Leaderboard teilnehmen</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Rangliste
  const scored = board
    .map((r) => ({ row: r, score: effectiveScore(r, period) }))
    .sort((a, b) => b.score - a.score || a.row.display_name.localeCompare(b.row.display_name));
  const myIndex = scored.findIndex((s) => s.row.user_id === userId);
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const myScore = myIndex >= 0 ? scored[myIndex].score : 0;

  return (
    <ScrollView
      style={[styles.container, embedded && styles.embedded]}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
    >
      {!embedded && <Text style={styles.title}>Bestenliste</Text>}

      <Segmented
        options={[{ key: 'week', label: 'Diese Woche' }, { key: 'month', label: 'Dieser Monat' }]}
        value={period}
        onChange={(k) => setPeriod(k as 'week' | 'month')}
        c={c}
      />

      {/* Mein Platz */}
      <View style={styles.myTile}>
        <View style={styles.myRankCircle}><Text style={styles.myRankText}>{myRank ?? '–'}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.myLabel}>DEIN PLATZ</Text>
          <Text style={styles.myValue}>{myScore} {myScore === 1 ? 'Ziel-Tag' : 'Ziel-Tage'} {period === 'week' ? 'diese Woche' : 'diesen Monat'}</Text>
        </View>
      </View>

      {/* Liste */}
      <View style={styles.tile}>
        <Text style={styles.tileLabel}>RANGLISTE</Text>
        {scored.length === 0 ? (
          <Text style={styles.empty}>Noch niemand dabei – sei die/der Erste! 🚀</Text>
        ) : (
          scored.map((s, i) => {
            const me = s.row.user_id === userId;
            return (
              <View key={s.row.user_id} style={[styles.rankRow, i > 0 && styles.rankDivider, me && styles.rankRowMe]}>
                <Text style={[styles.rankPos, i < 3 && styles.rankPosMedal]}>{medal(i + 1)}</Text>
                <Text style={[styles.rankName, me && styles.rankNameMe]} numberOfLines={1}>{s.row.display_name}{me ? '  (du)' : ''}</Text>
                <Text style={styles.rankScore}>{s.score}</Text>
              </View>
            );
          })
        )}
      </View>

      {/* Teilnahme-Fußzeile */}
      <View style={styles.tile}>
        <Text style={styles.footerNote}>Du nimmst teil. Es zählen Tage, an denen du etwas getrackt oder trainiert hast.</Text>
        <TouchableOpacity style={styles.leaveBtn} onPress={confirmLeave} disabled={busy} activeOpacity={0.85}>
          <Text style={styles.leaveText}>Nicht mehr teilnehmen</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 56, paddingHorizontal: 16 },
    embedded: { paddingTop: 4, paddingHorizontal: 0, backgroundColor: 'transparent' },
    title: { fontSize: 26, fontWeight: '800', color: c.heading, marginBottom: 14 },

    tile: { ...shadow, backgroundColor: c.card, borderRadius: 16, padding: 18, marginTop: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    tileLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: c.textMuted, marginBottom: 6 },
    empty: { fontSize: 14, color: c.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },

    // Opt-in
    joinIcon: { fontSize: 40, textAlign: 'center' },
    joinTitle: { fontSize: 20, fontWeight: '800', color: c.heading, textAlign: 'center', marginTop: 8 },
    joinText: { fontSize: 14, color: c.textMuted, lineHeight: 21, textAlign: 'center', marginTop: 10 },
    privacy: { backgroundColor: c.inputBg, borderRadius: 14, padding: 12, marginTop: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    privacyText: { fontSize: 13, color: c.text, lineHeight: 19 },
    label: { fontSize: 13, color: c.text, fontWeight: '700', marginTop: 16, marginBottom: 6 },
    input: { backgroundColor: c.inputBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: c.text, borderWidth: 1, borderColor: c.border },
    primaryBtn: { backgroundColor: c.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
    primaryText: { color: c.onPrimary, fontSize: 16, fontWeight: '800' },

    // Mein Platz
    myTile: { ...shadow, flexDirection: 'row', alignItems: 'center', backgroundColor: c.hero, borderRadius: 16, padding: 18, marginTop: 12 },
    myRankCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    myRankText: { color: '#fff', fontSize: 22, fontWeight: '800' },
    myLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
    myValue: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 3 },

    // Rangliste-Zeilen
    rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    rankDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    rankRowMe: { backgroundColor: c.inputBg, borderRadius: 14, marginHorizontal: -8, paddingHorizontal: 8 },
    rankPos: { width: 40, fontSize: 15, fontWeight: '800', color: c.textMuted },
    rankPosMedal: { fontSize: 20 },
    rankName: { flex: 1, fontSize: 15, color: c.text, fontWeight: '600', marginRight: 10 },
    rankNameMe: { color: c.primary, fontWeight: '800' },
    rankScore: { fontSize: 16, fontWeight: '800', color: c.heading },

    // Fußzeile
    footerNote: { fontSize: 13, color: c.textMuted, lineHeight: 19, marginBottom: 12 },
    leaveBtn: { borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: c.border },
    leaveText: { color: c.danger, fontSize: 14, fontWeight: '700' },
  });
}
