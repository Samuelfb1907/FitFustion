// Freund-Profil-Sheet (Phase 1c-lite): tippe einen Freund an -> sichere, motivierende
// Kennzahlen (Streak, Trainings, aktive Tage, Cardio, Tonnage, letzte Rekorde). Laedt per
// friend_profile-RPC (Freundschafts-geprueft). Schliessen per X oder Tap daneben.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import { FriendProfile as FP, fetchFriendProfile } from '../lib/friendProfile';

function ago(iso: string, t: (k: string, p?: Record<string, string | number>) => string): string {
  const min = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return t('friends.feed.minAgo', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('friends.feed.hAgo', { n: h });
  return t('friends.feed.dAgo', { n: Math.floor(h / 24) });
}

export default function FriendProfile({ friendCode, initialName, visible, onClose }: {
  friendCode: string; initialName: string; visible: boolean; onClose: () => void;
}) {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [data, setData] = useState<FP | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    setData(null);
    fetchFriendProfile(friendCode).then((d) => { if (active) { setData(d); setLoading(false); } });
    return () => { active = false; };
  }, [visible, friendCode]);

  const name = data?.display_name ?? initialName;
  const initial = (name.charAt(0) || '?').toUpperCase();
  const memberYear = data?.member_since ? new Date(data.member_since).getFullYear() : null;
  const tonnage = data ? (data.tonnage_kg >= 1000 ? `${(data.tonnage_kg / 1000).toFixed(1)} t` : `${data.tonnage_kg} kg`) : '–';

  const tiles = data ? [
    { key: 'streak', icon: 'flame', tint: '#F0574B', value: data.streak, label: t('friends.profile.streak') },
    { key: 'workouts', icon: 'barbell', tint: c.primary, value: data.workouts, label: t('friends.profile.workouts') },
    { key: 'active', icon: 'calendar', tint: '#F0B429', value: data.active_days, label: t('friends.profile.activeDays') },
    { key: 'cardio', icon: 'walk', tint: '#38B6FF', value: data.cardio_count, label: t('friends.profile.cardio') },
  ] : [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Tippen daneben schliesst. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('friends.comments.close')} />
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.close} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('friends.comments.close')}>
            <Ionicons name="close" size={24} color={c.textMuted} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
            <Text style={styles.name} numberOfLines={1}>{name}{data?.is_me ? `  ${t('friends.profile.me')}` : ''}</Text>
            {memberYear != null && <Text style={styles.since}>{t('friends.profile.memberSince', { date: memberYear })}</Text>}
          </View>

          {loading ? (
            <ActivityIndicator color={c.primary} style={{ marginVertical: 44 }} />
          ) : !data ? (
            <Text style={styles.err}>{t('friends.profile.unavailable')}</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }} contentContainerStyle={{ paddingBottom: 6 }}>
              <View style={styles.grid}>
                {tiles.map((tl) => (
                  <View key={tl.key} style={styles.tile}>
                    <View style={[styles.tileIcon, { backgroundColor: tl.tint + '22' }]}><Ionicons name={tl.icon as any} size={18} color={tl.tint} /></View>
                    <Text style={styles.tileVal}>{tl.value}</Text>
                    <Text style={styles.tileLabel}>{tl.label}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.chips}>
                <View style={styles.chip}><Text style={styles.chipVal}>🏆 {data.best_streak}</Text><Text style={styles.chipLabel}>{t('friends.profile.bestStreak')}</Text></View>
                <View style={styles.chip}><Text style={styles.chipVal}>🏗️ {tonnage}</Text><Text style={styles.chipLabel}>{t('friends.profile.tonnage')}</Text></View>
                <View style={styles.chip}><Text style={styles.chipVal}>🧱 {data.sets}</Text><Text style={styles.chipLabel}>{t('friends.profile.sets')}</Text></View>
              </View>

              <Text style={styles.sectionLabel}>{t('friends.profile.records')}</Text>
              {data.records.length === 0 ? (
                <Text style={styles.empty}>{t('friends.profile.noRecords')}</Text>
              ) : (
                <View style={styles.recordList}>
                  {data.records.map((r, i) => (
                    <View key={i} style={[styles.recordRow, i > 0 && styles.recordDivider]}>
                      <Ionicons name="trophy" size={16} color="#F0B429" />
                      <Text style={styles.recordEx} numberOfLines={1}>{r.ex ?? t('friends.profile.record')}</Text>
                      <Text style={styles.recordTime}>{ago(r.created_at, t)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 26 },
    close: { position: 'absolute', top: 14, right: 14, zIndex: 2, padding: 2 },

    header: { alignItems: 'center', marginBottom: 18 },
    avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    avatarText: { color: c.onPrimary, fontSize: 28, fontWeight: '900' },
    name: { fontSize: 20, fontWeight: '800', color: c.heading, maxWidth: '82%' },
    since: { fontSize: 12, color: c.textMuted, marginTop: 3, fontWeight: '600' },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    tile: { width: '47.6%', flexGrow: 1, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.cardBorder, paddingVertical: 14, alignItems: 'center' },
    tileIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
    tileVal: { fontSize: 24, fontWeight: '900', color: c.heading, letterSpacing: -0.5 },
    tileLabel: { fontSize: 12, color: c.textMuted, fontWeight: '600', marginTop: 1 },

    chips: { flexDirection: 'row', gap: 8, marginTop: 12 },
    chip: { flex: 1, backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.cardBorder, paddingVertical: 11, alignItems: 'center' },
    chipVal: { fontSize: 14, fontWeight: '800', color: c.heading },
    chipLabel: { fontSize: 11, color: c.textMuted, fontWeight: '600', marginTop: 2 },

    sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, color: c.textMuted, textTransform: 'uppercase', marginTop: 22, marginBottom: 10 },
    empty: { fontSize: 14, color: c.textMuted, textAlign: 'center', paddingVertical: 14, lineHeight: 20 },
    recordList: { backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    recordRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
    recordDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    recordEx: { flex: 1, fontSize: 14, color: c.text, fontWeight: '600' },
    recordTime: { fontSize: 12, color: c.textMuted },

    err: { fontSize: 14, color: c.textMuted, textAlign: 'center', paddingVertical: 40 },
  });
}
