// Bestenliste (opt-in, datenschutzfreundlich): Rangliste nach aktiven Ziel-Tagen
// (getrackt ODER trainiert) - umschaltbar Woche/Monat. Eigene Zeile hervorgehoben.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import Segmented from '../components/Segmented';
import GlassFill from '../components/GlassFill';
import ErrorRetry from '../components/ErrorRetry';
import { errorMessage } from '../lib/errors';
import { CARD_SHADOW as shadow } from '../lib/ui';
import { Ionicons } from '@expo/vector-icons';
import { LeaderRow, getMyEntry, joinLeaderboard, refreshMyScores, leaveLeaderboard, fetchBoard, effectiveScore } from '../lib/leaderboard';

const MEDAL_COLORS = ['#F0B429', '#C0C7CF', '#CD7F32']; // Gold, Silber, Bronze

export default function LeaderboardScreen({ embedded }: { embedded?: boolean }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [optedIn, setOptedIn] = useState(false);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [nameInput, setNameInput] = useState('');
  const [busy, setBusy] = useState(false);

  // Datenschutz: standardmaessig anonym - der echte Name wird NICHT vorausgewaehlt.
  const defaultName = t('leaderboard.defaultName');

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
      t('leaderboard.leave.confirmTitle'),
      t('leaderboard.leave.confirmBody'),
      [
        { text: t('leaderboard.leave.cancel'), style: 'cancel' },
        { text: t('leaderboard.leave.remove'), style: 'destructive', onPress: doLeave },
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
        {!embedded && <Text style={styles.title}>{t('leaderboard.title')}</Text>}
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (err) {
    return (
      <View style={[styles.container, embedded && styles.embedded]}>
        {!embedded && <Text style={styles.title}>{t('leaderboard.title')}</Text>}
        <ErrorRetry message={err} onRetry={() => init()} embedded={embedded} />
      </View>
    );
  }

  // Opt-in-Ansicht
  if (!optedIn) {
    return (
      <ScrollView style={[styles.container, embedded && styles.embedded]} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {!embedded && <Text style={styles.title}>{t('leaderboard.title')}</Text>}
        <View style={styles.tile}>
          <GlassFill radius={20} />
          <View style={styles.joinChip}><Ionicons name="trophy" size={30} color={c.primary} /></View>
          <Text style={styles.joinTitle}>{t('leaderboard.join.heading')}</Text>
          <Text style={styles.joinText}>
            {t('leaderboard.join.intro')}{' '}
            <Text style={{ fontWeight: '700', color: c.text }}>{t('leaderboard.join.introBold')}</Text> {t('leaderboard.join.introEnd')}
          </Text>
          <View style={styles.privacy}>
            <Text style={styles.privacyText}>
              {t('leaderboard.join.privacy')}
            </Text>
          </View>
          <Text style={styles.label}>{t('leaderboard.join.nameLabel')}</Text>
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
            {busy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.primaryText}>{t('leaderboard.join.cta')}</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Rangliste
  const scored = board
    .map((r) => ({ row: r, score: effectiveScore(r, period) }))
    .sort((a, b) => b.score - a.score || a.row.display_name.localeCompare(b.row.display_name));
  const myIndex = scored.findIndex((s) => s.row.is_me);
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const myScore = myIndex >= 0 ? scored[myIndex].score : 0;

  return (
    <ScrollView
      style={[styles.container, embedded && styles.embedded]}
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
    >
      {!embedded && <Text style={styles.title}>{t('leaderboard.title')}</Text>}

      <Segmented
        options={[{ key: 'week', label: t('leaderboard.period.week') }, { key: 'month', label: t('leaderboard.period.month') }]}
        value={period}
        onChange={(k) => setPeriod(k as 'week' | 'month')}
        c={c}
      />

      {/* Mein Platz */}
      <View style={styles.myTile}>
        <View style={styles.myRankCircle}><Text style={styles.myRankText}>{myRank ?? '–'}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.myLabel}>{t('leaderboard.myRank.label')}</Text>
          <Text style={styles.myValue}>{t(period === 'week' ? 'leaderboard.myRank.valueWeek' : 'leaderboard.myRank.valueMonth', { n: myScore, unit: t(myScore === 1 ? 'leaderboard.unit.daySingular' : 'leaderboard.unit.dayPlural') })}</Text>
        </View>
      </View>

      {/* Liste */}
      <View style={styles.tile}>
        <GlassFill radius={16} />
        <Text style={styles.tileLabel}>{t('leaderboard.list.label')}</Text>
        {scored.length === 0 ? (
          <Text style={styles.empty}>{t('leaderboard.list.empty')}</Text>
        ) : (
          scored.map((s, i) => {
            const me = s.row.is_me;
            return (
              <View key={i} style={[styles.rankRow, i > 0 && styles.rankDivider, me && styles.rankRowMe]}>
                {i < 3 ? (
                  <View style={styles.rankPosBox}><Ionicons name="medal" size={22} color={MEDAL_COLORS[i]} /></View>
                ) : (
                  <Text style={styles.rankPos}>#{i + 1}</Text>
                )}
                <Text style={[styles.rankName, me && styles.rankNameMe]} numberOfLines={1}>{s.row.display_name}{me ? t('leaderboard.list.you') : ''}</Text>
                <Text style={styles.rankScore} numberOfLines={1}>{s.score}</Text>
              </View>
            );
          })
        )}
      </View>

      {/* Teilnahme-Fußzeile */}
      <View style={styles.tile}>
        <GlassFill radius={16} />
        <Text style={styles.footerNote}>{t('leaderboard.footer.note')}</Text>
        <TouchableOpacity style={styles.leaveBtn} onPress={confirmLeave} disabled={busy} activeOpacity={0.85}>
          <Text style={styles.leaveText}>{t('leaderboard.footer.leave')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 56, paddingHorizontal: 16 },
    embedded: { paddingTop: 4, paddingHorizontal: 0, backgroundColor: 'transparent' },
    title: { fontSize: 28, fontWeight: '800', color: c.heading, letterSpacing: -0.5, marginBottom: 14 },

    tile: { ...shadow, backgroundColor: c.card, borderRadius: 20, padding: 18, marginTop: 12, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    tileLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: c.textMuted, marginBottom: 8 },
    empty: { fontSize: 14, color: c.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },

    // Opt-in
    joinChip: { width: 60, height: 60, borderRadius: 20, backgroundColor: 'rgba(25,201,143,0.12)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
    joinTitle: { fontSize: 20, fontWeight: '800', color: c.heading, textAlign: 'center', marginTop: 8 },
    joinText: { fontSize: 14, color: c.textMuted, lineHeight: 21, textAlign: 'center', marginTop: 10 },
    privacy: { backgroundColor: c.inputBg, borderRadius: 14, padding: 12, marginTop: 16, borderWidth: 1, borderColor: c.cardBorder },
    privacyText: { fontSize: 13, color: c.text, lineHeight: 19 },
    label: { fontSize: 13, color: c.text, fontWeight: '700', marginTop: 16, marginBottom: 6 },
    input: { backgroundColor: c.inputBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: c.text, borderWidth: 1, borderColor: c.border },
    primaryBtn: { backgroundColor: c.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
    primaryText: { color: c.onPrimary, fontSize: 16, fontWeight: '800' },

    // Mein Platz
    myTile: { ...shadow, flexDirection: 'row', alignItems: 'center', backgroundColor: c.hero, borderRadius: 20, padding: 18, marginTop: 12, overflow: 'hidden' },
    myRankCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    myRankText: { color: '#fff', fontSize: 22, fontWeight: '800' },
    myLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
    myValue: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 3 },

    // Rangliste-Zeilen
    rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    rankDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    rankRowMe: { backgroundColor: c.inputBg, borderRadius: 14, marginHorizontal: -8, paddingHorizontal: 8 },
    rankPos: { width: 40, fontSize: 15, fontWeight: '800', color: c.textMuted },
    rankPosBox: { width: 40, alignItems: 'flex-start' },
    rankName: { flex: 1, fontSize: 15, color: c.text, fontWeight: '600', marginRight: 10 },
    rankNameMe: { color: c.primary, fontWeight: '800' },
    rankScore: { fontSize: 16, fontWeight: '800', color: c.heading },

    // Fußzeile
    footerNote: { fontSize: 13, color: c.textMuted, lineHeight: 19, marginBottom: 12 },
    leaveBtn: { borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: c.border },
    leaveText: { color: c.danger, fontSize: 14, fontWeight: '700' },
  });
}
