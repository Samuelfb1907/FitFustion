// Gespeicherten GPS-Lauf ansehen: Karte mit Strecke + Distanz/Zeit/Tempo/kcal. Read-only.
// Native Karte nur geschuetzt geladen (lib/gpsNative). Dauer wird aus den Route-Zeitstempeln
// berechnet (genauer als die auf Minuten gerundete Speicherung).
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT, useLang } from '../contexts/LanguageContext';
import { GpsPoint, speedKmh, formatSpeed, formatDuration, formatDistance, shareRegion, simplifyRoute } from '../lib/gps';
import { getMapView, getPolyline, getMarker } from '../lib/gpsNative';
import { buildRunCardFile, writeSnapshotFile, runCardDate } from '../lib/runShareCard';

type LatLng = { latitude: number; longitude: number };

function boundsRegion(pts: LatLng[]): any {
  if (pts.length === 0) return undefined;
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

export default function RunDetail({ visible, onClose, activityKey, route, distanceM, minutes, kcal }: {
  visible: boolean; onClose: () => void; activityKey: string; route: GpsPoint[]; distanceM: number; minutes: number; kcal: number;
}) {
  const c = useColors();
  const t = useT();
  const { lang } = useLang();
  const styles = useMemo(() => makeStyles(c), [c]);
  const MapView = getMapView();
  const Polyline = getPolyline();
  const Marker = getMarker();
  const mapRef = useRef<any>(null);
  const [sharing, setSharing] = useState(false);

  // Geglaettete Route (GPS-Zittern raus) - auch fuer schon gespeicherte alte Laeufe.
  const pts = useMemo(() => simplifyRoute(route ?? [], 6), [route]);
  const coords: LatLng[] = pts.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  const durationS = pts.length > 1 ? Math.round((pts[pts.length - 1].t - pts[0].t) / 1000) : minutes * 60;
  const kmh = speedKmh(distanceM, durationS);

  // Teilen: Der Server baut das komplette Strava-Style-Bild selbst (saubere Karte ohne
  // Laeden-Namen, glatte Route, Werte fest im Bild) - wir schicken nur Ausschnitt + Strecke.
  // Faellt der Server aus -> Apple-Karten-Schnappschuss als Notloesung.
  async function shareRun() {
    if (sharing) return;
    setSharing(true);
    try {
      const sr = shareRegion(pts);
      if (!sr) return;
      const caption = `${t('gps.type.' + activityKey)} · ${formatDistance(distanceM)} · ${formatDuration(durationS)} · ${formatSpeed(kmh)} ${t('gps.speedUnit')} 🏃 — FitAvo`;
      let uri = await buildRunCardFile({
        region: sr,
        route: pts,
        title: t('gps.type.' + activityKey),
        date: runCardDate(pts[0]?.t ?? Date.now(), lang),
        stats: [
          { label: t('gps.stat.distance'), value: formatDistance(distanceM) },
          { label: t('gps.stat.time'), value: formatDuration(durationS) },
          { label: t('gps.stat.speed'), value: `${formatSpeed(kmh)} ${t('gps.speedUnit')}` },
        ],
        kcalText: kcal > 0 ? `${kcal} kcal` : '',
      });
      if (!uri) {
        // Notloesung: roher Karten-Schnappschuss (z. B. offline).
        const snap = await mapRef.current?.takeSnapshot?.({ width: 360, height: 300, region: sr, format: 'png', quality: 1, result: 'base64' });
        uri = snap ? await writeSnapshotFile(snap) : null;
      }
      if (!uri) return;
      if (Platform.OS === 'ios') await Share.share({ url: uri, message: caption });
      else if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: caption });
    } catch {} finally { setSharing(false); }
  }

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.stat}><Text style={styles.statVal}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <Ionicons name="chevron-down" size={28} color={c.textMuted} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t(`gps.type.${activityKey}`)}</Text>
          <TouchableOpacity onPress={shareRun} disabled={sharing} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('gps.share')}>
            {sharing ? <ActivityIndicator size="small" color={c.primary} /> : <Ionicons name="share-outline" size={26} color={c.primary} />}
          </TouchableOpacity>
        </View>

        {MapView && coords.length > 1 ? (
          <MapView ref={mapRef} style={styles.map} region={boundsRegion(coords)} scrollEnabled showsPointsOfInterest={false} pitchEnabled={false} rotateEnabled={false} toolbarEnabled={false}>
            {Polyline && <Polyline coordinates={coords} strokeColor={c.primary} strokeWidth={6} lineCap="round" lineJoin="round" />}
            {/* Start/Ziel als dezente Punkte (das Teilen-Bild malt der Server komplett selbst) */}
            {Marker && (
              <Marker coordinate={coords[0]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={styles.routeDotStart} />
              </Marker>
            )}
            {Marker && (
              <Marker coordinate={coords[coords.length - 1]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={styles.routeDotEnd} />
              </Marker>
            )}
          </MapView>
        ) : (
          <View style={[styles.map, styles.mapFallback]}><Text style={{ fontSize: 44 }}>🗺️</Text></View>
        )}

        <View style={styles.statsBar}>
          <View style={styles.statsRow}>
            <Stat label={t('gps.stat.distance')} value={formatDistance(distanceM)} />
            <Stat label={t('gps.stat.time')} value={formatDuration(durationS)} />
          </View>
          <View style={styles.statsRow}>
            <Stat label={t('gps.stat.speed')} value={`${formatSpeed(kmh)} ${t('gps.speedUnit')}`} />
            <Stat label={t('gps.stat.kcal')} value={`${kcal}`} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 10 },
    headerTitle: { fontSize: 17, fontWeight: '800', color: c.heading },
    map: { flex: 1 },
    mapFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.card },
    routeDotStart: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#19C98F', borderWidth: 3, borderColor: '#FFFFFF' },
    routeDotEnd: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#F0574B', borderWidth: 3, borderColor: '#FFFFFF' },
    statsBar: { backgroundColor: c.bg, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 34, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20 },
    statsRow: { flexDirection: 'row' },
    stat: { flex: 1, alignItems: 'center', paddingVertical: 8 },
    statVal: { fontSize: 28, fontWeight: '900', color: c.heading, letterSpacing: -1 },
    statLabel: { fontSize: 12, color: c.textMuted, fontWeight: '600', marginTop: 2 },
  });
}
