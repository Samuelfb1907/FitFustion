// Fortschritts-Fotos (#76e): horizontale Galerie + Hinzufuegen (Kamera/Galerie) + Vollbild-
// Betrachter mit Loeschen. Privat (signierte URLs). Selbst-ladend; Karte auf dem Fortschritt-Tab.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import { ProgressPhoto, listPhotos, uploadPhoto, deletePhoto } from '../lib/photos';
import { hTap } from '../lib/haptics';

export default function ProgressPhotos({ focusTick }: { focusTick?: number }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<ProgressPhoto | null>(null);

  useEffect(() => { load(); }, [userId]);
  useEffect(() => { if (focusTick) load(); }, [focusTick]);

  async function load() {
    if (!userId) { setLoading(false); return; }
    setPhotos(await listPhotos(userId));
    setLoading(false);
  }

  async function pick(fromCamera: boolean) {
    if (!userId || busy) return;
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('photos.permTitle'), t('photos.permBody')); return; }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    setBusy(true);
    const ok = await uploadPhoto(userId, res.assets[0].uri);
    setBusy(false);
    if (ok) { hTap(); await load(); } else { Alert.alert(t('photos.uploadFailed')); }
  }

  function add() {
    Alert.alert(t('photos.addTitle'), undefined, [
      { text: t('photos.camera'), onPress: () => pick(true) },
      { text: t('photos.gallery'), onPress: () => pick(false) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  function confirmDelete(p: ProgressPhoto) {
    Alert.alert(t('photos.deleteTitle'), t('photos.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { await deletePhoto(p); setViewer(null); await load(); } },
    ]);
  }

  if (loading) return <ActivityIndicator color={c.primary} style={{ marginVertical: 16 }} />;

  return (
    <View>
      {photos.length === 0 && <Text style={styles.empty}>{t('photos.empty')}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 2 }}>
        <TouchableOpacity style={styles.addTile} onPress={add} disabled={busy} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('photos.addTitle')}>
          {busy ? <ActivityIndicator color={c.primary} /> : <><Ionicons name="camera" size={24} color={c.primary} /><Text style={styles.addText}>{t('photos.add')}</Text></>}
        </TouchableOpacity>
        {photos.map((p) => (
          <TouchableOpacity key={p.id} onPress={() => setViewer(p)} activeOpacity={0.85}>
            <Image source={{ uri: p.url }} style={styles.thumb} contentFit="cover" transition={150} />
            <Text style={styles.thumbDate}>{ddmm(p.takenAt)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewerBg}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewer(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </TouchableOpacity>
          {viewer && <Image source={{ uri: viewer.url }} style={styles.viewerImg} contentFit="contain" transition={150} />}
          <View style={styles.viewerBar}>
            <Text style={styles.viewerMeta}>{viewer ? fullDate(viewer.takenAt) : ''}{viewer?.weightKg != null ? ` · ${viewer.weightKg} kg` : ''}</Text>
            <TouchableOpacity onPress={() => viewer && confirmDelete(viewer)} accessibilityRole="button" accessibilityLabel={t('common.delete')}>
              <Ionicons name="trash-outline" size={22} color="#FF6B6B" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ddmm(d: string): string { const [y, m, dd] = d.split('-'); return `${dd}.${m}.`; }
function fullDate(d: string): string { const [y, m, dd] = d.split('-'); return `${dd}.${m}.${y}`; }

function makeStyles(c: Colors) {
  return StyleSheet.create({
    empty: { fontSize: 13, color: c.textMuted, fontStyle: 'italic', marginBottom: 10, lineHeight: 18 },
    addTile: { width: 86, height: 116, borderRadius: 14, borderWidth: 1.5, borderColor: c.primary, borderStyle: 'dashed', backgroundColor: c.inputBg, alignItems: 'center', justifyContent: 'center', gap: 5 },
    addText: { fontSize: 12, fontWeight: '700', color: c.primary },
    thumb: { width: 86, height: 116, borderRadius: 14, backgroundColor: c.inputBg },
    thumbDate: { fontSize: 11, fontWeight: '700', color: c.textMuted, textAlign: 'center', marginTop: 4 },
    viewerBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
    viewerClose: { position: 'absolute', top: 50, right: 22, zIndex: 2 },
    viewerImg: { width: '92%', height: '74%' },
    viewerBar: { position: 'absolute', bottom: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '86%', paddingHorizontal: 4 },
    viewerMeta: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  });
}
