// Cardio-Reiter im Training-Hub: Art waehlen -> Dauer eintragen -> App rechnet die
// verbrannten Kalorien (MET-Methode, siehe lib/cardio.ts) aus dem Koerpergewicht.
// Eingetragene Einheiten landen in cardio_sessions und lassen das Kalorien-Tagesziel
// mitwachsen (Home & Tracker lesen sie ueber todayCardioKcal). Cardio ist gratis.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import { CARDIO_TYPES, CardioType, cardioKcal, cardioTypeByKey } from '../lib/cardio';
import { logActivity } from '../lib/activity';
import { useKeyboardHeight } from '../lib/useKeyboardHeight';
import { startOfTodayISO } from '../lib/date';
import { errorMessage } from '../lib/errors';
import { TAB_BAR_SPACE } from '../lib/layout';
import { hSuccess, hTap } from '../lib/haptics';
import GlassFill from './GlassFill';
import RunTracker from './RunTracker';
import RunDetail from './RunDetail';
import { gpsAvailable } from '../lib/gpsNative';
import { GpsPoint, formatDistance } from '../lib/gps';

type Session = { id: string; activity_key: string; minutes: number; kcal: number; performed_at: string; route: GpsPoint[] | null; distance_m: number | null };
const QUICK_MINS = [10, 20, 30, 45, 60];

export default function CardioTab({ onChanged }: { onChanged?: () => void }) {
  const { session } = useAuth();
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const uid = session?.user?.id;
  const kb = useKeyboardHeight();

  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [picked, setPicked] = useState<CardioType | null>(null);
  const [mins, setMins] = useState('30');
  const [saving, setSaving] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const [detail, setDetail] = useState<Session | null>(null);
  const [editing, setEditing] = useState<Session | null>(null); // bestehenden Eintrag korrigieren

  const load = useCallback(async () => {
    if (!uid) { setLoading(false); return; }
    try {
      const [{ data: prof }, { data: sess }] = await Promise.all([
        supabase.from('profiles').select('weight_kg').eq('id', uid).maybeSingle(),
        supabase.from('cardio_sessions').select('id, activity_key, minutes, kcal, performed_at, route, distance_m')
          .eq('user_id', uid).gte('performed_at', startOfTodayISO()).order('performed_at', { ascending: false }),
      ]);
      setWeightKg(prof?.weight_kg != null ? Number(prof.weight_kg) : null);
      setSessions((sess ?? []) as Session[]);
    } catch {
      // still, keine harte Fehleranzeige – Cardio ist optional
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const todayBurned = useMemo(() => sessions.reduce((s, x) => s + (Number(x.kcal) || 0), 0), [sessions]);
  const minsNum = useMemo(() => {
    const n = parseFloat(String(mins).replace(',', '.'));
    return isFinite(n) && n > 0 ? n : 0;
  }, [mins]);
  const preview = picked && weightKg ? cardioKcal(picked.met, weightKg, minsNum) : 0;

  function openPicker(ct: CardioType) {
    if (!weightKg) return; // ohne Gewicht keine Berechnung moeglich
    hTap();
    setPicked(ct);
    setMins('30');
    setEditing(null);
  }

  // Bestehenden Eintrag antippen -> Dialog mit aktueller Dauer vorbelegen (z. B. 60 statt 90 Min
  // korrigieren). Beim Speichern werden Minuten + neu berechnete Kalorien aktualisiert.
  function openEdit(s: Session) {
    const ct = cardioTypeByKey(s.activity_key);
    if (!ct || !weightKg) return;
    hTap();
    setPicked(ct);
    setMins(String(Math.round(Number(s.minutes))));
    setEditing(s);
  }

  function closeModal() { setPicked(null); setEditing(null); }

  async function logIt() {
    if (!uid || !picked || !weightKg || minsNum <= 0 || saving) return;
    setSaving(true);
    const kcal = cardioKcal(picked.met, weightKg, minsNum);
    const { error } = await supabase.from('cardio_sessions').insert({
      user_id: uid, activity_key: picked.key, minutes: minsNum, kcal, performed_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { Alert.alert(errorMessage(error)); return; }
    hSuccess();
    logActivity('cardio', t(`cardio.type.${picked.key}`)); // Freunde-Feed (fire-and-forget)
    closeModal();
    await load();
    onChanged?.();
  }

  // Korrektur speichern: Minuten + neu berechnete Kalorien am bestehenden Eintrag aktualisieren.
  async function saveEdit() {
    if (!uid || !picked || !weightKg || !editing || minsNum <= 0 || saving) return;
    setSaving(true);
    const kcal = cardioKcal(picked.met, weightKg, minsNum);
    const { error } = await supabase.from('cardio_sessions').update({ minutes: minsNum, kcal }).eq('id', editing.id);
    setSaving(false);
    if (error) { Alert.alert(errorMessage(error)); return; }
    hSuccess();
    closeModal();
    await load();
    onChanged?.();
  }

  function confirmDelete(s: Session) {
    Alert.alert(t('cardio.deleteTitle'), t('cardio.deleteBody'), [
      { text: t('exercise.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('cardio_sessions').delete().eq('id', s.id);
          if (error) { Alert.alert(errorMessage(error)); return; }
          hTap();
          await load();
          onChanged?.();
        },
      },
    ]);
  }

  if (loading) return <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} />;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}>
      <Text style={styles.intro}>{t('cardio.intro')}</Text>

      {gpsAvailable() && (
        <TouchableOpacity style={styles.gpsBtn} onPress={() => setShowRun(true)} activeOpacity={0.9}>
          <View style={styles.gpsIcon}><Ionicons name="location" size={22} color={c.onPrimary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.gpsBtnTitle}>{t('gps.entryButton')}</Text>
            <Text style={styles.gpsBtnSub}>{t('gps.entrySub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.onPrimary} />
        </TouchableOpacity>
      )}

      {todayBurned > 0 && (
        <View style={styles.summary}>
          <GlassFill radius={20} />
          <View style={styles.summaryIcon}><Ionicons name="flame" size={22} color={c.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryVal}>{todayBurned} kcal</Text>
            <Text style={styles.summarySub}>{t('cardio.todayBurned')} · {t('cardio.addedToGoal')}</Text>
          </View>
        </View>
      )}

      {!weightKg && (
        <View style={styles.note}>
          <GlassFill radius={16} />
          <Ionicons name="information-circle-outline" size={18} color={c.textMuted} />
          <Text style={styles.noteText}>{t('cardio.needWeight')}</Text>
        </View>
      )}

      <Text style={styles.sectionLabel}>{t('cardio.pick')}</Text>
      <View style={styles.grid}>
        {CARDIO_TYPES.map((ct) => (
          <TouchableOpacity
            key={ct.key}
            style={[styles.card, !weightKg && { opacity: 0.5 }]}
            activeOpacity={0.8}
            onPress={() => openPicker(ct)}
            disabled={!weightKg}
            accessibilityRole="button"
            accessibilityLabel={t(`cardio.type.${ct.key}`)}
          >
            <View style={styles.cardIcon}><Ionicons name={ct.icon as any} size={22} color={c.primary} /></View>
            <Text style={styles.cardName} numberOfLines={1}>{t(`cardio.type.${ct.key}`)}</Text>
            {!!weightKg && (
              <Text style={styles.cardHint} numberOfLines={1}>{t('cardio.perHalfHour', { n: cardioKcal(ct.met, weightKg, 30) })}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionLabel, { marginTop: 22 }]}>{t('cardio.today')}</Text>
      {sessions.length === 0 ? (
        <View style={styles.note}>
          <GlassFill radius={16} />
          <Text style={styles.noteText}>{t('cardio.empty')}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          <GlassFill radius={20} />
          {sessions.map((s, idx) => {
            const ct = cardioTypeByKey(s.activity_key);
            return (
              <View key={s.id} style={[styles.row, idx > 0 && styles.rowDivider]}>
                <TouchableOpacity style={styles.rowMain} activeOpacity={0.6} onPress={s.route ? () => setDetail(s) : () => openEdit(s)} accessibilityRole="button" accessibilityLabel={s.route ? t(`cardio.type.${s.activity_key}`) : t('cardio.edit')}>
                  <View style={styles.rowIcon}><Ionicons name={(ct?.icon ?? 'flame') as any} size={18} color={c.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{t(`cardio.type.${s.activity_key}`)}{s.route ? '  🗺️' : ''}</Text>
                    <Text style={styles.rowMeta}>{s.distance_m ? `${formatDistance(s.distance_m)} · ` : ''}{Math.round(Number(s.minutes))} {t('cardio.minUnit')} · {s.kcal} kcal</Text>
                  </View>
                </TouchableOpacity>
                {!s.route && (
                  <TouchableOpacity onPress={() => openEdit(s)} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('cardio.edit')}>
                    <Ionicons name="create-outline" size={19} color={c.textMuted} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => confirmDelete(s)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('cardio.deleteTitle')}>
                  <Ionicons name="trash-outline" size={20} color={c.textMuted} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* Eingabe-Dialog: Dauer waehlen, Live-Vorschau der Kalorien, eintragen. */}
      <Modal visible={!!picked} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={[styles.overlay, { paddingBottom: kb }]}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <View style={styles.modalIcon}><Ionicons name={(picked?.icon ?? 'flame') as any} size={24} color={c.primary} /></View>
              <Text style={styles.modalTitle}>{picked ? (t(`cardio.type.${picked.key}`) + (editing ? ' · ' + t('cardio.editTitle') : '')) : ''}</Text>
            </View>

            <View style={styles.previewWrap}>
              <Text style={styles.previewVal}>{preview}</Text>
              <Text style={styles.previewUnit}>kcal · {t('cardio.burned')}</Text>
            </View>

            <Text style={styles.modalLabel}>{t('cardio.duration')} ({t('cardio.minUnit')})</Text>
            <View style={styles.quickRow}>
              {QUICK_MINS.map((q) => {
                const on = minsNum === q;
                return (
                  <TouchableOpacity key={q} onPress={() => setMins(String(q))} style={[styles.quickChip, on && styles.quickChipOn]} activeOpacity={0.85}>
                    <Text style={[styles.quickText, on && styles.quickTextOn]}>{q}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={styles.input}
              value={mins}
              onChangeText={(v) => setMins(v.replace(/[^0-9.,]/g, ''))}
              keyboardType="numeric"
              inputMode="numeric"
              maxLength={4}
              placeholder="30"
              placeholderTextColor={c.textMuted}
              underlineColorAndroid="transparent"
            />

            <TouchableOpacity style={[styles.cta, (minsNum <= 0 || saving) && { opacity: 0.6 }]} onPress={editing ? saveEdit : logIt} disabled={minsNum <= 0 || saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.ctaText}>{editing ? t('cardio.save') : t('cardio.log')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancel} onPress={closeModal} activeOpacity={0.7}>
              <Text style={styles.cancelText}>{t('exercise.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {showRun && <RunTracker visible={showRun} onClose={() => setShowRun(false)} onSaved={load} />}
      {detail && (
        <RunDetail visible={!!detail} onClose={() => setDetail(null)} activityKey={detail.activity_key}
          route={detail.route ?? []} distanceM={detail.distance_m ?? 0} minutes={detail.minutes} kcal={detail.kcal} />
      )}
    </ScrollView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    intro: { fontSize: 14, color: c.textMuted, lineHeight: 20, marginBottom: 16 },
    sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: c.textMuted, textTransform: 'uppercase', marginBottom: 12 },

    summary: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.cardBorder, padding: 16, marginBottom: 16, overflow: 'hidden' },
    summaryIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(25,201,143,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    summaryVal: { fontSize: 22, fontWeight: '800', color: c.heading },
    summarySub: { fontSize: 12, color: c.textMuted, marginTop: 2 },

    note: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 8, overflow: 'hidden' },
    noteText: { flex: 1, fontSize: 13, color: c.textMuted, lineHeight: 19 },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    card: { width: '31.5%', backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.cardBorder, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center' },
    cardIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(25,201,143,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    cardName: { fontSize: 13, fontWeight: '700', color: c.text, textAlign: 'center' },
    cardHint: { fontSize: 10, color: c.textMuted, marginTop: 3, textAlign: 'center' },

    list: { backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, gap: 12 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(25,201,143,0.12)', alignItems: 'center', justifyContent: 'center' },
    rowName: { fontSize: 15, fontWeight: '600', color: c.text },
    rowMeta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    gpsBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.primary, borderRadius: 18, padding: 16, marginBottom: 18 },
    gpsIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    gpsBtnTitle: { color: c.onPrimary, fontSize: 16, fontWeight: '800' },
    gpsBtnSub: { color: c.onPrimary, fontSize: 12, fontWeight: '600', opacity: 0.9, marginTop: 1 },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 24 },
    modalCard: { backgroundColor: c.bg, borderRadius: 22, padding: 22, borderWidth: 1, borderColor: c.cardBorder },
    modalHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
    modalIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(25,201,143,0.12)', alignItems: 'center', justifyContent: 'center' },
    modalTitle: { fontSize: 20, fontWeight: '800', color: c.heading, flex: 1 },
    previewWrap: { alignItems: 'center', marginVertical: 16 },
    previewVal: { fontSize: 46, fontWeight: '800', color: c.primary, letterSpacing: -1 },
    previewUnit: { fontSize: 13, color: c.textMuted, fontWeight: '600', marginTop: -2 },
    modalLabel: { fontSize: 13, color: c.text, fontWeight: '700', marginBottom: 8 },
    quickRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    quickChip: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.inputBg, alignItems: 'center' },
    quickChipOn: { borderColor: c.primary, backgroundColor: 'rgba(25,201,143,0.12)' },
    quickText: { fontSize: 14, fontWeight: '700', color: c.textMuted },
    quickTextOn: { color: c.primary },
    input: { backgroundColor: c.inputBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 17, color: c.text, borderWidth: 1, borderColor: c.border, textAlign: 'center', fontWeight: '700' },
    cta: { backgroundColor: c.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
    ctaText: { color: c.onPrimary, fontSize: 16, fontWeight: '800' },
    cancel: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
    cancelText: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
  });
}
