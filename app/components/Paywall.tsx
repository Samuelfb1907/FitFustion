// Globaler Paywall-Anbieter: stellt openPaywall() bereit und rendert EINEN
// Premium-Bildschirm (Bottom-Sheet) ueber der ganzen App. Gesperrte Funktionen
// rufen openPaywall() auf, wenn ein Gratis-Nutzer sie antippt.
//
// Die ECHTE Bezahlung (Apple/Google via RevenueCat) wird erst im fertigen App-Build
// angebunden. Bis dahin erklaert der "Freischalten"-Button das und verweist auf den
// Test-Schalter in den Einstellungen.
import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors, Colors } from '../contexts/ThemeContext';

export const PREMIUM_PRICE = '25 € / Monat';

const BENEFITS = [
  ['🍽️', 'KI-Mahlzeitenerkennung', '„Sprich’s einfach" – einfach eintippen, was du gegessen hast.'],
  ['📷', 'Barcode-Scanner', 'Lebensmittel per Kamera scannen statt suchen.'],
  ['🏆', 'Bestenliste', 'Tritt gegen andere an und sammle Platzierungen.'],
  ['💪', 'Alle Übungen', 'Jede Übung je Muskel – statt nur 2 in der Gratis-Version.'],
  ['⭐', 'Level, XP & Erfolge', 'Sammle Erfahrung, steige im Level auf, schalte Erfolge frei.'],
  ['🗓️', 'Trainingspläne', 'Erstelle eigene Pläne mit Wochenkalender.'],
];

type Ctx = { openPaywall: (feature?: string) => void };
const PaywallCtx = createContext<Ctx>({ openPaywall: () => {} });
export function usePaywall() { return useContext(PaywallCtx); }

export function PaywallProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const openPaywall = useCallback(() => setVisible(true), []);
  return (
    <PaywallCtx.Provider value={{ openPaywall }}>
      {children}
      <PaywallSheet visible={visible} onClose={() => setVisible(false)} />
    </PaywallCtx.Provider>
  );
}

function PaywallSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const s = makeStyles(c);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <Text style={s.kicker}>FitAvo</Text>
          <Text style={s.title}>Premium 🥑</Text>
          <Text style={s.price}>{PREMIUM_PRICE} · monatlich kündbar</Text>

          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ paddingVertical: 6 }} showsVerticalScrollIndicator={false}>
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
            style={s.cta}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Premium freischalten"
            onPress={() => {
              onClose();
              Alert.alert(
                'Bald verfügbar',
                'Die Bezahlung wird mit der fertigen App (App Store / Play Store) aktiviert.\n\nZum Ausprobieren kannst du Premium vorübergehend in den Einstellungen ein- und ausschalten.',
              );
            }}
          >
            <Text style={s.ctaText}>Premium freischalten</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={s.later} accessibilityRole="button" accessibilityLabel="Schließen">
            <Text style={s.laterText}>Vielleicht später</Text>
          </TouchableOpacity>
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
    row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
    icon: { fontSize: 22, marginRight: 12, marginTop: 1 },
    rowTitle: { fontSize: 15, fontWeight: '700', color: c.heading },
    rowDesc: { fontSize: 13, color: c.textMuted, marginTop: 1, lineHeight: 18 },
    cta: { marginTop: 14, backgroundColor: c.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
    ctaText: { color: c.onPrimary, fontSize: 17, fontWeight: '800' },
    later: { marginTop: 12, alignItems: 'center' },
    laterText: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
  });
}
