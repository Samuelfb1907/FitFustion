// Trainings-Liga (#76b): Wochen-Liga mit Auf-/Abstieg. Selbst-ladend; Reiter im Lobby-Tab.
// Leerzustand = noch nicht beigetreten -> Beitritt mit Anzeigenamen. Sonst Rangliste der
// eigenen Liga-Instanz mit Aufstiegs-/Abstiegszonen und Countdown bis zum Wochen-Reset.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import GlassFill from './GlassFill';
import Confetti from './Confetti';
import { CARD_SHADOW as shadow } from '../lib/ui';
import { hSuccess } from '../lib/haptics';
import { LeagueRow, LEAGUE_TIERS, zoneSize, leagueBoard, leagueJoin } from '../lib/league';

// Stufen-Optik (1=Bronze ... 5=Diamant). Reihenfolge passt zu tier-1 als Index.
const TIER_META = [
  { color: '#CD7F32', emoji: '🥉' }, // Bronze
  { color: '#9AA4AF', emoji: '🥈' }, // Silber
  { color: '#F0B429', emoji: '🥇' }, // Gold
  { color: '#3FB8AF', emoji: '💠' }, // Platin
  { color: '#6E8BFF', emoji: '💎' }, // Diamant
];

// Verbleibende Zeit bis naechsten Montag 00:00 (lokal ~ Europe/Berlin).
function timeToReset(): { d: number; h: number; m: number } {
  const now = new Date();
  const daysUntilMon = ((8 - now.getDay()) % 7) || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilMon);
  next.setHours(0, 0, 0, 0);
  const ms = Math.max(0, next.getTime() - now.getTime());
  return { d: Math.floor(ms / 86400000), h: Math.floor((ms % 86400000) / 3600000), m: Math.floor((ms % 3600000) / 60000) };
}

export default function LeaguePanel({ focusTick }: { focusTick?: number }) {
  const c = useColors();
  const t = useT();
  const { profile } = useAuth();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [rows, setRows] = useState<LeagueRow[] | null>(null); // null=laden/Fehler, []=nicht beigetreten
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [joining, setJoining] = useState(false);
  const [name, setName] = useState('');
  const [confettiKey, setConfettiKey] = useState(0);

  useEffect(() => { load(); }, []);
  useEffect(() => { if (focusTick) load(); }, [focusTick]);
  useEffect(() => { setName((prev) => (prev === '' ? (profile?.first_name ?? '') : prev)); }, [profile?.first_name]);

  async function load() {
    const data = await leagueBoard();
    setRows(data);
    setError(data === null);
    setLoading(false);
  }

  async function join() {
    setJoining(true);
    const tier = await leagueJoin(name.trim() || (profile?.first_name ?? 'Sportler'));
    if (tier != null) { hSuccess(); setConfettiKey((k) => k + 1); await load(); }
    setJoining(false);
  }

  if (loading) return <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 30 }} />;

  if (error) {
    return (
      <View style={styles.card}>
        <GlassFill radius={20} />
        <Text style={styles.errText}>{t('league.error')}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => { setLoading(true); load(); }} activeOpacity={0.85}>
          <Text style={styles.primaryText}>{t('league.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Noch nicht beigetreten -> Beitritts-Karte.
  if (!rows || rows.length === 0) {
    return (
      <View>
        <View style={styles.heroTile}>
          <GlassFill radius={20} />
          <Text style={styles.heroEmoji}>🏆</Text>
          <Text style={styles.heroTitle}>{t('league.join.title')}</Text>
          <Text style={styles.heroBody}>{t('league.join.body')}</Text>
        </View>
        <View style={styles.card}>
          <GlassFill radius={20} />
          <Text style={styles.label}>{t('league.join.nameLabel')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('league.join.namePlaceholder')}
            placeholderTextColor={c.textMuted}
            maxLength={24}
            autoCorrect={false}
            underlineColorAndroid="transparent"
          />
          <TouchableOpacity style={[styles.primaryBtn, joining && { opacity: 0.6 }]} onPress={join} disabled={joining} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('league.join.cta')}>
            {joining ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.primaryText}>{t('league.join.cta')}</Text>}
          </TouchableOpacity>
          <Text style={styles.hint}>{t('league.pointsHint')}</Text>
        </View>
        <Confetti fireKey={confettiKey} />
      </View>
    );
  }

  const n = rows.length;
  const myTier = rows[0]?.tier ?? 1;
  const meta = TIER_META[myTier - 1] ?? TIER_META[0];
  const z = zoneSize(n);
  const hasPromote = myTier < LEAGUE_TIERS;            // Diamant kann nicht aufsteigen
  const hasRelegate = myTier > 1 && (n - z) > z;       // Bronze kann nicht absteigen; Zonen nicht ueberlappen
  const myRank = rows.findIndex((r) => r.isMe) + 1;
  const rt = timeToReset();
  const resetLabel = rt.d >= 1 ? t('league.resetDays', { d: rt.d, h: rt.h }) : t('league.resetHours', { h: rt.h, m: rt.m });
  const initial = (s: string) => (s.charAt(0) || '?').toUpperCase();

  return (
    <View>
      {/* Kopf: Stufe + Countdown + eigener Platz */}
      <View style={[styles.heroTile, { borderColor: meta.color + '66' }]}>
        <GlassFill radius={20} />
        <View style={styles.tierBadge}>
          <Text style={styles.tierEmoji}>{meta.emoji}</Text>
          <Text style={[styles.tierName, { color: meta.color }]}>{t(`league.tier.${myTier}`)}</Text>
        </View>
        <Text style={styles.heroTitle}>{t('league.headerTitle')}</Text>
        <Text style={styles.resetText}>{resetLabel}</Text>
        {myRank > 0 && <Text style={styles.myRank}>{t('league.myRank', { rank: myRank, total: n })}</Text>}
      </View>

      {/* Rangliste mit Auf-/Abstiegszonen */}
      <View style={styles.card}>
        <GlassFill radius={20} />
        {hasPromote && <Text style={[styles.zoneLabel, { color: c.success }]}>{t('league.promoteZone')}</Text>}
        {rows.map((r, i) => {
          const rank = i + 1;
          const inPromote = hasPromote && rank <= z;
          const inRelegate = hasRelegate && rank > n - z;
          return (
            <View key={i}>
              {hasRelegate && rank === n - z + 1 && <Text style={[styles.zoneLabel, { color: c.danger, marginTop: 6 }]}>{t('league.relegateZone')}</Text>}
              <View style={[styles.row, i > 0 && styles.rowDivider, r.isMe && styles.rowMe]}>
                <Text style={[styles.rank, inPromote && { color: c.success }, inRelegate && { color: c.danger }]}>{rank}</Text>
                <View style={[styles.avatar, r.isMe && { backgroundColor: c.primary }]}><Text style={[styles.avatarText, r.isMe && { color: c.onPrimary }]}>{initial(r.displayName)}</Text></View>
                <Text style={[styles.name, r.isMe && { fontWeight: '800', color: c.heading }]} numberOfLines={1}>{r.displayName}{r.isMe ? t('league.you') : ''}</Text>
                <Text style={[styles.points, r.isMe && { color: c.primary }]}>{t('league.points', { n: r.points })}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <Text style={styles.hint}>{t('league.pointsHint')}</Text>
      <Confetti fireKey={confettiKey} />
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    heroTile: { ...shadow, backgroundColor: c.card, borderRadius: 20, padding: 18, marginTop: 14, alignItems: 'center', borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    heroEmoji: { fontSize: 34, marginBottom: 6 },
    heroTitle: { fontSize: 17, fontWeight: '800', color: c.heading, textAlign: 'center' },
    heroBody: { fontSize: 14, color: c.textMuted, textAlign: 'center', lineHeight: 20, marginTop: 6 },
    tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    tierEmoji: { fontSize: 26 },
    tierName: { fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
    resetText: { fontSize: 13, color: c.textMuted, fontWeight: '600', marginTop: 8 },
    myRank: { fontSize: 14, color: c.heading, fontWeight: '700', marginTop: 4 },

    card: { ...shadow, backgroundColor: c.card, borderRadius: 20, padding: 16, marginTop: 14, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    zoneLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },

    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 12 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    rowMe: { backgroundColor: c.inputBg },
    rank: { width: 24, textAlign: 'center', fontSize: 15, fontWeight: '800', color: c.textMuted },
    avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.inputBg, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: c.heading, fontSize: 15, fontWeight: '800' },
    name: { flex: 1, fontSize: 15, color: c.text, fontWeight: '600' },
    points: { fontSize: 14, color: c.textMuted, fontWeight: '800' },

    label: { fontSize: 13, color: c.text, fontWeight: '700', marginBottom: 8 },
    input: { backgroundColor: c.inputBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, fontWeight: '600', color: c.text, borderWidth: 1, borderColor: c.border, marginBottom: 12 },
    primaryBtn: { backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    primaryText: { color: c.onPrimary, fontSize: 16, fontWeight: '800' },
    hint: { fontSize: 12, color: c.textMuted, textAlign: 'center', marginTop: 12, lineHeight: 17 },
    errText: { fontSize: 14, color: c.danger, textAlign: 'center', marginBottom: 12 },
  });
}
