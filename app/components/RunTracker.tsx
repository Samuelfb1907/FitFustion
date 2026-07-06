// GPS-Lauf (Phase 3, Stufe 1 = Vordergrund): Art waehlen -> live Distanz/Zeit/Tempo/kcal +
// Route live auf der Karte -> Stopp -> Zusammenfassung mit Karte -> speichern (als cardio_session
// mit route + distance_m; zaehlt aufs Kalorienziel + Freunde-Feed). Native Module (Standort/Karte)
// werden nur GESCHUETZT geladen (lib/gpsNative) - im aktuellen Build ohne sie oeffnet sich dieser
// Screen gar nicht erst. Bildschirm bleibt via keep-awake an.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import {
  GPS_ACTIVITIES, GpsActivityKey, GpsPoint, gpsActivityByKey, gpsKcal,
  haversineM, paceSecPerKm, formatPace, formatDuration, formatDistance,
} from '../lib/gps';
import { getLocation, getMapView, getPolyline, getMarker, keepAwake } from '../lib/gpsNative';
import { logActivity } from '../lib/activity';
import { hSuccess, hTap } from '../lib/haptics';

type Phase = 'select' | 'tracking' | 'paused' | 'summary';
type LatLng = { latitude: number; longitude: number };

function boundsRegion(pts: LatLng[]): any {
  if (pts.length === 0) return null;
  let minLat = pts[0].latitude, maxLat = pts[0].latitude, minLng = pts[0].longitude, maxLng = pts[0].longitude;
  for (const p of pts) {
    minLat = Math.min(minLat, p.latitude); maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude); maxLng = Math.max(maxLng, p.longitude);
  }
  return {
    latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.004, (maxLat - minLat) * 1.6), longitudeDelta: Math.max(0.004, (maxLng - minLng) * 1.6),
  };
}

export default function RunTracker({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved?: () => void }) {
  const { session } = useAuth();
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const uid = session?.user?.id;

  const Location = getLocation();
  const MapView = getMapView();
  const Polyline = getPolyline();
  const Marker = getMarker();

  const [phase, setPhase] = useState<Phase>('select');
  const [activityKey, setActivityKey] = useState<GpsActivityKey>('running');
  const [points, setPoints] = useState<GpsPoint[]>([]);
  const [distanceM, setDistanceM] = useState(0);
  const [elapsedS, setElapsedS] = useState(0);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [gpsReady, setGpsReady] = useState(false);
  const [region, setRegion] = useState<any>(null);

  const watchRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const startedAtRef = useRef<number>(0);
  const pausedMsRef = useRef<number>(0);
  const pauseStartRef = useRef<number>(0);
  const pointsRef = useRef<GpsPoint[]>([]);
  const distRef = useRef<number>(0);
  const phaseRef = useRef<Phase>('select');
  phaseRef.current = phase;

  useEffect(() => {
    if (!uid || !visible) return;
    supabase.from('profiles').select('weight_kg').eq('id', uid).maybeSingle()
      .then(({ data }) => setWeightKg(data?.weight_kg != null ? Number(data.weight_kg) : null));
  }, [uid, visible]);

  useEffect(() => {
    if (phase !== 'tracking') return;
    const id = setInterval(() => {
      setElapsedS(Math.max(0, Math.floor((Date.now() - startedAtRef.current - pausedMsRef.current) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => () => { stopWatch(); keepAwake(false); }, []);

  function stopWatch() {
    try { watchRef.current?.remove?.(); } catch {}
    watchRef.current = null;
  }

  async function begin() {
    if (!Location) { Alert.alert(t('gps.unavailable')); return; }
    if (!weightKg) { Alert.alert(t('gps.needWeight')); return; }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert(t('gps.permTitle'), t('gps.permDenied')); return; }
    } catch { Alert.alert(t('gps.unavailable')); return; }

    pointsRef.current = []; distRef.current = 0;
    setPoints([]); setDistanceM(0); setElapsedS(0); setGpsReady(false);
    startedAtRef.current = Date.now(); pausedMsRef.current = 0;
    hTap(); keepAwake(true); setPhase('tracking');

    try {
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy?.High ?? 4, distanceInterval: 4, timeInterval: 2000 },
        (loc: any) => {
          const p: GpsPoint = { lat: loc.coords.latitude, lng: loc.coords.longitude, t: loc.timestamp ?? Date.now() };
          setRegion({ latitude: p.lat, longitude: p.lng, latitudeDelta: 0.004, longitudeDelta: 0.004 });
          setGpsReady(true);
          if (phaseRef.current !== 'tracking') return;
          const prev = pointsRef.current[pointsRef.current.length - 1];
          if (prev) {
            const seg = haversineM(prev, p);
            if (seg >= 3) { distRef.current += seg; setDistanceM(distRef.current); }
          }
          pointsRef.current = [...pointsRef.current, p];
          setPoints(pointsRef.current);
        },
      );
    } catch { Alert.alert(t('gps.unavailable')); keepAwake(false); setPhase('select'); }
  }

  function pause() { hTap(); pauseStartRef.current = Date.now(); setPhase('paused'); }
  function resume() { hTap(); pausedMsRef.current += Date.now() - pauseStartRef.current; setPhase('tracking'); }

  function stop() {
    hTap();
    if (phase === 'paused') pausedMsRef.current += Date.now() - pauseStartRef.current;
    stopWatch(); keepAwake(false);
    setElapsedS(Math.max(0, Math.floor((Date.now() - startedAtRef.current - pausedMsRef.current) / 1000)));
    setPhase('summary');
  }

  async function save() {
    if (!uid || saving) return;
    const durationS = elapsedS;
    if (distRef.current < 50 || durationS < 20) { Alert.alert(t('gps.tooShort')); return; }
    const act = gpsActivityByKey(activityKey);
    if (!act) return;
    setSaving(true);
    const kcal = gpsKcal(act.met, weightKg ?? 0, durationS);
    const { error } = await supabase.from('cardio_sessions').insert({
      user_id: uid, activity_key: activityKey, minutes: Math.max(1, Math.round(durationS / 60)),
      kcal, performed_at: new Date(startedAtRef.current).toISOString(),
      route: pointsRef.current, distance_m: Math.round(distRef.current),
    });
    setSaving(false);
    if (error) { Alert.alert(error.message); return; }
    hSuccess();
    logActivity('cardio', `${t('gps.type.' + activityKey)} · ${formatDistance(distRef.current)}`);
    onSaved?.();
    reset(); onClose();
  }

  function reset() {
    stopWatch(); keepAwake(false);
    setPhase('select'); setPoints([]); pointsRef.current = [];
    setDistanceM(0); distRef.current = 0; setElapsedS(0); setRegion(null);
  }

  // Karte als Bild aufnehmen (react-native-maps takeSnapshot) + teilen (Insta/WhatsApp/...).
  async function shareRun() {
    try {
      const uri = await mapRef.current?.takeSnapshot?.({ format: 'png', quality: 0.9, result: 'file' });
      if (!uri) return;
      const caption = `${t('gps.type.' + activityKey)} · ${formatDistance(distanceM)} · ${formatDuration(elapsedS)} · ${formatPace(paceSecPerKm(distanceM, elapsedS))} ${t('gps.paceUnit')} 🏃 — FitAvo`;
      if (Platform.OS === 'ios') await Share.share({ url: uri, message: caption });
      else if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: caption });
    } catch {}
  }

  function requestClose() {
    if (phase === 'tracking' || phase === 'paused') {
      Alert.alert(t('gps.discardTitle'), t('gps.discardBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('gps.discard'), style: 'destructive', onPress: () => { reset(); onClose(); } },
      ]);
      return;
    }
    reset(); onClose();
  }

  const pace = paceSecPerKm(distanceM, elapsedS);
  const act = gpsActivityByKey(activityKey);
  const kcalLive = weightKg && act ? gpsKcal(act.met, weightKg, elapsedS) : 0;
  const coords: LatLng[] = points.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  const summaryRegion = phase === 'summary' ? boundsRegion(coords) : region;

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.stat}><Text style={styles.statVal}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>
  );

  const renderMap = (interactive: boolean) => {
    if (!MapView) return <View style={[styles.map, styles.mapFallback]}><Text style={styles.mapFallbackText}>🗺️</Text></View>;
    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        region={summaryRegion ?? undefined}
        showsUserLocation={interactive}
        followsUserLocation={interactive && phase === 'tracking'}
        scrollEnabled={!interactive}
        pitchEnabled={false} rotateEnabled={false} toolbarEnabled={false}
      >
        {Polyline && coords.length > 1 && <Polyline coordinates={coords} strokeColor={c.primary} strokeWidth={5} />}
        {Marker && coords.length > 0 && phase === 'summary' && (
          <Marker coordinate={coords[0]} pinColor="green" />
        )}
      </MapView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={requestClose} presentationStyle="fullScreen">
      <View style={styles.root}>
        {/* Kopf */}
        <View style={styles.header}>
          <TouchableOpacity onPress={requestClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <Ionicons name="chevron-down" size={28} color={c.textMuted} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{phase === 'summary' ? t('gps.summaryTitle') : t('gps.title')}</Text>
          {phase === 'summary' ? (
            <TouchableOpacity onPress={shareRun} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('gps.share')}>
              <Ionicons name="share-outline" size={26} color={c.primary} />
            </TouchableOpacity>
          ) : <View style={{ width: 28 }} />}
        </View>

        {phase === 'select' ? (
          <View style={styles.selectWrap}>
            <Text style={styles.selectLabel}>{t('gps.title')}</Text>
            <View style={styles.typeRow}>
              {GPS_ACTIVITIES.map((a) => {
                const on = a.key === activityKey;
                return (
                  <TouchableOpacity key={a.key} style={[styles.typeCard, on && styles.typeCardOn]} onPress={() => { hTap(); setActivityKey(a.key); }} activeOpacity={0.85}>
                    <Ionicons name={a.icon as any} size={26} color={on ? c.onPrimary : c.primary} />
                    <Text style={[styles.typeText, on && { color: c.onPrimary }]}>{t(`gps.type.${a.key}`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.hint}>{t('gps.keepOpenHint')}</Text>
            <TouchableOpacity style={styles.startBtn} onPress={begin} activeOpacity={0.85}>
              <Ionicons name="play" size={22} color={c.onPrimary} />
              <Text style={styles.startText}>{t('gps.start')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {renderMap(phase !== 'summary')}
            {phase !== 'summary' && !gpsReady && (
              <View style={styles.gpsBadge}><ActivityIndicator color={c.onPrimary} size="small" /><Text style={styles.gpsBadgeText}>{t('gps.waitingGps')}</Text></View>
            )}
            <View style={styles.statsBar}>
              <View style={styles.statsRow}>
                <Stat label={t('gps.stat.distance')} value={formatDistance(distanceM)} />
                <Stat label={t('gps.stat.time')} value={formatDuration(elapsedS)} />
              </View>
              <View style={styles.statsRow}>
                <Stat label={t('gps.stat.pace')} value={`${formatPace(pace)} ${t('gps.paceUnit')}`} />
                <Stat label={t('gps.stat.kcal')} value={`${kcalLive}`} />
              </View>

              {phase === 'summary' ? (
                <View style={styles.summaryBtns}>
                  <TouchableOpacity style={styles.discardBtn} onPress={requestClose} activeOpacity={0.8}>
                    <Text style={styles.discardText}>{t('gps.discard')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
                    {saving ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.saveText}>{t('gps.save')}</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.trackBtns}>
                  {phase === 'tracking' ? (
                    <TouchableOpacity style={styles.pauseBtn} onPress={pause} activeOpacity={0.85}>
                      <Ionicons name="pause" size={24} color={c.heading} /><Text style={styles.pauseText}>{t('gps.pause')}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.pauseBtn} onPress={resume} activeOpacity={0.85}>
                      <Ionicons name="play" size={24} color={c.heading} /><Text style={styles.pauseText}>{t('gps.resume')}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.stopBtn} onPress={stop} activeOpacity={0.85}>
                    <Ionicons name="stop" size={24} color={c.onPrimary} /><Text style={styles.stopText}>{t('gps.stop')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 10 },
    headerTitle: { fontSize: 17, fontWeight: '800', color: c.heading },

    selectWrap: { flex: 1, paddingHorizontal: 20, justifyContent: 'center' },
    selectLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1.4, color: c.textMuted, textTransform: 'uppercase', marginBottom: 12, textAlign: 'center' },
    typeRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    typeCard: { flex: 1, backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.cardBorder, paddingVertical: 22, alignItems: 'center', gap: 8 },
    typeCardOn: { backgroundColor: c.primary, borderColor: c.primary },
    typeText: { fontSize: 14, fontWeight: '700', color: c.text },
    hint: { fontSize: 13, color: c.textMuted, textAlign: 'center', lineHeight: 19, marginBottom: 24 },
    startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: c.primary, borderRadius: 18, paddingVertical: 18 },
    startText: { color: c.onPrimary, fontSize: 18, fontWeight: '800' },

    map: { flex: 1 },
    mapFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.card },
    mapFallbackText: { fontSize: 44 },
    gpsBadge: { position: 'absolute', top: 108, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
    gpsBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    statsBar: { backgroundColor: c.bg, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 30, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20 },
    statsRow: { flexDirection: 'row' },
    stat: { flex: 1, alignItems: 'center', paddingVertical: 8 },
    statVal: { fontSize: 30, fontWeight: '900', color: c.heading, letterSpacing: -1 },
    statLabel: { fontSize: 12, color: c.textMuted, fontWeight: '600', marginTop: 2 },

    trackBtns: { flexDirection: 'row', gap: 12, marginTop: 12 },
    pauseBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, borderRadius: 16, paddingVertical: 16 },
    pauseText: { fontSize: 16, fontWeight: '800', color: c.heading },
    stopBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F0574B', borderRadius: 16, paddingVertical: 16 },
    stopText: { fontSize: 16, fontWeight: '800', color: '#fff' },

    summaryBtns: { flexDirection: 'row', gap: 12, marginTop: 12 },
    discardBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, borderRadius: 16, paddingVertical: 16 },
    discardText: { fontSize: 16, fontWeight: '700', color: c.textMuted },
    saveBtn: { flex: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary, borderRadius: 16, paddingVertical: 16 },
    saveText: { fontSize: 16, fontWeight: '800', color: c.onPrimary },
  });
}
