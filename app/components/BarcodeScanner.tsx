// Vollbild-Kamera zum Scannen von Lebensmittel-Barcodes (EAN/UPC).
// Nutzt expo-camera (laeuft in Expo Go auf einem echten Geraet).
import { useEffect, useState } from 'react';
import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';

export default function BarcodeScanner({
  visible,
  c,
  onClose,
  onScanned,
}: {
  visible: boolean;
  c: Colors;
  onClose: () => void;
  onScanned: (code: string) => void;
}) {
  const styles = makeStyles(c);
  const t = useT();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  // Bei jedem Oeffnen wieder scanbereit
  useEffect(() => {
    if (visible) setScanned(false);
  }, [visible]);

  // Beim Oeffnen automatisch nach Kamera-Erlaubnis fragen
  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, permission?.granted]);

  function handle(result: { data: string }) {
    if (scanned) return;
    setScanned(true);
    onScanned(result.data);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        {!permission ? (
          <View style={styles.center}>
            <Text style={styles.info}>{t('scanner.preparingCamera')}</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.info}>{t('scanner.permissionInfo')}</Text>
            {permission.canAskAgain ? (
              <TouchableOpacity style={styles.btn} onPress={requestPermission}>
                <Text style={styles.btnText}>{t('scanner.allowCamera')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.btn} onPress={() => Linking.openSettings()}>
                <Text style={styles.btnText}>{t('scanner.openSettings')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.linkBtn} onPress={onClose}>
              <Text style={styles.link}>{t('scanner.cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
              onBarcodeScanned={scanned ? undefined : handle}
            />
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.frame} />
              <Text style={styles.hint}>{t('scanner.hint')}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.closeText}>{t('scanner.close')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: c.bg },
    info: { fontSize: 16, color: c.text, textAlign: 'center', lineHeight: 23, marginBottom: 22 },
    btn: { backgroundColor: c.primary, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
    btnText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
    linkBtn: { marginTop: 16, padding: 8 },
    link: { color: c.textMuted, fontSize: 15 },
    overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    frame: { width: 260, height: 170, borderWidth: 3, borderColor: '#fff', borderRadius: 16, backgroundColor: 'transparent' },
    hint: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 18, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
    closeBtn: { position: 'absolute', bottom: 44, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 24, paddingHorizontal: 24, paddingVertical: 13 },
    closeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
}
