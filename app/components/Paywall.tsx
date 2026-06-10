// Globaler Paywall-Anbieter: stellt openPaywall() bereit und rendert EINEN
// Premium-Bildschirm (Bottom-Sheet) ueber der ganzen App. Gesperrte Funktionen
// rufen openPaywall() auf, wenn ein Gratis-Nutzer sie antippt.
//
// Die Bezahlung laeuft ueber RevenueCat (Apple/Google). Der "Freischalten"-Button
// startet den echten Kauf — nur in einem echten App-Build verfuegbar (nicht Expo Go).
// Mit dem Test-Store-Schluessel laesst sich der Kauf ohne App/Play Store ausprobieren.
import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors, Colors } from '../contexts/ThemeContext';
import LegalText from './LegalText';
import { TERMS_SECTIONS, PRIVACY_SECTIONS } from '../lib/legal';
import { purchasePremium, restorePurchases } from '../lib/purchases';

export const PREMIUM_PRICE = '25 € / Monat';

const BENEFITS = [
  ['🍽️', 'KI-Mahlzeitenerkennung', '„Sprich’s einfach" – einfach eintippen, was du gegessen hast.'],
  ['📷', 'Barcode-Scanner', 'Lebensmittel per Kamera scannen statt suchen.'],
  ['🏆', 'Bestenliste', 'Tritt gegen andere an und sammle Platzierungen.'],
  ['💪', 'Alle Übungen', 'Jede Übung je Muskel – statt nur 2 in der Gratis-Version.'],
  ['⭐', 'Level, XP & Erfolge', 'Sammle Erfahrung, steige im Level auf, schalte Erfolge frei.'],
  ['🗓️', 'Trainingspläne', 'Erstelle eigene Pläne mit Wochenkalender.'],
];

// Feature-spezifischer Hinweis oben in der Paywall (je nachdem, was angetippt wurde).
const FEATURE_HINT: Record<string, string> = {
  ki: 'Schalte die KI-Mahlzeitenerkennung frei',
  scan: 'Schalte den Barcode-Scanner frei',
  leaderboard: 'Tritt mit Premium der Bestenliste bei',
  level: 'Sammle XP, Level & Erfolge mit Premium',
  plan: 'Erstelle eigene Trainingspläne mit Premium',
  exercises: 'Alle Übungen je Muskel mit Premium',
};

type Ctx = { openPaywall: (feature?: string) => void };
const PaywallCtx = createContext<Ctx>({ openPaywall: () => {} });
export function usePaywall() { return useContext(PaywallCtx); }

export function PaywallProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [feature, setFeature] = useState<string | undefined>(undefined);
  const openPaywall = useCallback((f?: string) => { setFeature(f); setVisible(true); }, []);
  return (
    <PaywallCtx.Provider value={{ openPaywall }}>
      {children}
      <PaywallSheet visible={visible} feature={feature} onClose={() => setVisible(false)} />
    </PaywallCtx.Provider>
  );
}

function PaywallSheet({ visible, feature, onClose }: { visible: boolean; feature?: string; onClose: () => void }) {
  const c = useColors();
  const s = makeStyles(c);
  const [legal, setLegal] = useState<null | 'terms' | 'privacy'>(null);
  const [busy, setBusy] = useState(false);
  const close = () => { setLegal(null); onClose(); };

  const handlePurchase = async () => {
    if (busy) return;
    setBusy(true);
    const outcome = await purchasePremium();
    setBusy(false);
    if (outcome === 'success') {
      close();
      Alert.alert('Premium aktiviert 🎉', 'Viel Spaß mit allen Funktionen!');
    } else if (outcome === 'unavailable') {
      Alert.alert(
        'Noch nicht verfügbar',
        'Der Kauf ist gerade nicht möglich. Bitte stelle sicher, dass du eine aktuelle App-Version nutzt, und versuche es später erneut.',
      );
    } else if (outcome === 'error') {
      Alert.alert('Kauf fehlgeschlagen', 'Bitte versuche es später erneut.');
    }
    // 'cancelled' -> nichts tun
  };

  const handleRestore = async () => {
    if (busy) return;
    setBusy(true);
    const outcome = await restorePurchases();
    setBusy(false);
    if (outcome === 'success') {
      close();
      Alert.alert('Wiederhergestellt', 'Dein Premium-Zugang ist wieder aktiv.');
    } else if (outcome === 'unavailable') {
      Alert.alert('Nicht verfügbar', 'Wiederherstellen geht nur in einem echten App-Build.');
    } else if (outcome === 'none') {
      Alert.alert('Nichts gefunden', 'Es wurden keine früheren Käufe gefunden.');
    } else {
      Alert.alert('Wiederherstellen fehlgeschlagen', 'Bitte versuche es später erneut.');
    }
  };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          {legal ? (
            <>
              <Text style={s.title}>{legal === 'terms' ? 'Nutzungsbedingungen' : 'Datenschutzerklärung'}</Text>
              <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ paddingVertical: 10 }} showsVerticalScrollIndicator={false}>
                <LegalText c={c} sections={legal === 'terms' ? TERMS_SECTIONS : PRIVACY_SECTIONS} />
              </ScrollView>
              <TouchableOpacity style={s.cta} activeOpacity={0.85} onPress={() => setLegal(null)} accessibilityRole="button" accessibilityLabel="Zurück">
                <Text style={s.ctaText}>Zurück</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.kicker}>FitAvo</Text>
              <Text style={s.title}>Premium 🥑</Text>
              <Text style={s.price}>{PREMIUM_PRICE} · monatlich kündbar</Text>
              {feature && FEATURE_HINT[feature] && (
                <Text style={s.featureHint}>{FEATURE_HINT[feature]}</Text>
              )}

              <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ paddingVertical: 6 }} showsVerticalScrollIndicator={false}>
                {BENEFITS.map(([icon, title, desc]) => (
                  <View key={title} style={s.row}>
                    <Text style={s.icon}>{icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle}>{title}</Text>
                      <Text style={s.rowDesc}>{desc}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={[s.cta, busy && { opacity: 0.6 }]}
                activeOpacity={0.85}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Premium freischalten"
                onPress={handlePurchase}
              >
                <Text style={s.ctaText}>{busy ? 'Wird verarbeitet…' : 'Premium freischalten'}</Text>
              </TouchableOpacity>

              <Text style={s.fineprint}>
                Das Abo verlängert sich automatisch um je 1 Monat ({PREMIUM_PRICE}), bis du kündigst. Die Abrechnung läuft über dein Apple-/Google-Konto. Kündigung jederzeit in dessen Abo-Einstellungen.
              </Text>
              <View style={s.linksRow}>
                <Text style={s.link} onPress={handleRestore}>Käufe wiederherstellen</Text>
              </View>
              <View style={s.linksRow}>
                <Text style={s.link} onPress={() => setLegal('terms')}>Nutzungsbedingungen</Text>
                <Text style={s.linkDot}>·</Text>
                <Text style={s.link} onPress={() => setLegal('privacy')}>Datenschutz</Text>
              </View>

              <TouchableOpacity onPress={close} style={s.later} accessibilityRole="button" accessibilityLabel="Schließen">
                <Text style={s.laterText}>Vielleicht später</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 26 },
    kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 1, color: c.textMuted },
    title: { fontSize: 26, fontWeight: '800', color: c.heading, marginTop: 2 },
    price: { fontSize: 15, fontWeight: '700', color: c.primary, marginTop: 2, marginBottom: 12 },
    featureHint: { fontSize: 14, fontWeight: '700', color: c.heading, marginTop: -4, marginBottom: 10 },
    row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
    icon: { fontSize: 22, marginRight: 12, marginTop: 1 },
    rowTitle: { fontSize: 15, fontWeight: '700', color: c.heading },
    rowDesc: { fontSize: 13, color: c.textMuted, marginTop: 1, lineHeight: 18 },
    cta: { marginTop: 14, backgroundColor: c.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
    ctaText: { color: c.onPrimary, fontSize: 17, fontWeight: '800' },
    later: { marginTop: 10, alignItems: 'center' },
    laterText: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
    fineprint: { color: c.textMuted, fontSize: 11, lineHeight: 15, marginTop: 12, textAlign: 'center' },
    linksRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8, gap: 8 },
    link: { color: c.primary, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
    linkDot: { color: c.textMuted, fontSize: 13 },
  });
}
