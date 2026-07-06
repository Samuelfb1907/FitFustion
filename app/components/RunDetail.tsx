// Gespeicherten GPS-Lauf ansehen: Karte mit Strecke + Distanz/Zeit/Tempo/kcal. Read-only.
// Native Karte nur geschuetzt geladen (lib/gpsNative). Dauer wird aus den Route-Zeitstempeln
// berechnet (genauer als die auf Minuten gerundete Speicherung).
import { useMemo, useRef } from 'react';
import { Modal, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import { GpsPoint, paceSecPerKm, formatPace, formatDuration, formatDistance } from '../lib/gps';
import { getMapView, getPolyline, getMarker } from '../lib/gpsNative';

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
  const styles = useMemo(() => makeStyles(c), [c]);
  const MapView = getMapView();
  const Polyline = getPolyline();
  const Marker = getMarker();
  const mapRef = useRef<any>(null);

  const pts = route ?? [];
  const coords: LatLng[] = pts.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  const durationS = pts.length > 1 ? Math.round((pts[pts.length - 1].t - pts[0].t) / 1000) : minutes * 60;
  const pace = paceSecPerKm(distanceM, durationS);

  async function shareRun() {
    try {
      const uri = await mapRef.current?.takeSnapshot?.({ format: 'png', quality: 0.9, result: 'file' });
      if (!uri) return;
      const caption = `${t('gps.type.' + activityKey)} · ${formatDistance(distanceM)} · ${formatDuration(durationS)} · ${formatPace(pace)} ${t('gps.paceUnit')} 🏃 — FitAvo`;
      if (Platform.OS === 'ios') await Share.share({ url: uri, message: caption });
      else if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: caption });
    } catch {}
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
          <TouchableOpacity onPress={shareRun} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('gps.share')}>
            <Ionicons name="share-outline" size={26} color={c.primary} />
          </TouchableOpacity>
        </View>

        {MapView && coords.length > 1 ? (
          <MapView ref={mapRef} style={styles.map} region={boundsRegion(coords)} scrollEnabled pitchEnabled={false} rotateEnabled={false} toolbarEnabled={false}>
            {Polyline && <Polyline coordinates={coords} strokeColor={c.primary} strokeWidth={5} />}
            {Marker && <Marker coordinate={coords[0]} pinColor="green" />}
            {Marker && <Marker coordinate={coords[coords.length - 1]} pinColor="red" />}
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
            <Stat label={t('gps.stat.pace')} value={`${formatPace(pace)} ${t('gps.paceUnit')}`} />
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
    statsBar: { backgroundColor: c.bg, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 34, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20 },
    statsRow: { flexDirection: 'row' },
    stat: { flex: 1, alignItems: 'center', paddingVertical: 8 },
    statVal: { fontSize: 28, fontWeight: '900', color: c.heading, letterSpacing: -1 },
    statLabel: { fontSize: 12, color: c.textMuted, fontWeight: '600', marginTop: 2 },
  });
}
