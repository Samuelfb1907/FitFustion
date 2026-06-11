// Globaler Paywall-Anbieter: stellt openPaywall() bereit und rendert EINEN
// Premium-Bildschirm (Bottom-Sheet) ueber der ganzen App. Gesperrte Funktionen
// rufen openPaywall() auf, wenn ein Gratis-Nutzer sie antippt.
//
// Die Bezahlung laeuft ueber RevenueCat (Apple/Google). Die Paywall zeigt das
// Monats- UND Jahres-Paket aus dem aktuellen Offering zur Auswahl (echter
// Store-Preis + 7-Tage-Gratis-Test). Der Kauf-Button startet den echten Kauf
// des gewaehlten Pakets — nur in einem echten App-Build (nicht in Expo Go).
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors, Colors } from '../contexts/ThemeContext';
import LegalText from './LegalText';
import { TERMS_SECTIONS, PRIVACY_SECTIONS } from '../lib/legal';
import { getPremiumPlans, purchasePlan, restorePurchases, PremiumPlan, PremiumPlans } from '../lib/purchases';

// Anzeige-Fallback, falls der echte Store-Preis (noch) nicht geladen werden kann.
export const PREMIUM_PRICE = '9,99 € / Monat';

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

type PlanKey = 'monthly' | 'annual';

function PaywallSheet({ visible, feature, onClose }: { visible: boolean; feature?: string; onClose: () => void }) {
  const c = useColors();
  const s = makeStyles(c);
  const [legal, setLegal] = useState<null | 'terms' | 'privacy'>(null);
  const [busy, setBusy] = useState(false);
  const [plans, setPlans] = useState<PremiumPlans | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selected, setSelected] = useState<PlanKey>('annual');

  // Pakete laden, sobald die Paywall geoeffnet wird.
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoadingPlans(true);
    getPremiumPlans().then((p) => {
      if (!active) return;
      setPlans(p);
      setSelected(p.annual ? 'annual' : 'monthly');
      setLoadingPlans(false);
    });
    return () => { active = false; };
  }, [visible]);

  const close = () => { setLegal(null); onClose(); };

  const monthly = plans?.monthly ?? null;
  const annual = plans?.annual ?? null;
  const activePlan: PremiumPlan | null = (selected === 'annual' ? annual : monthly) ?? annual ?? monthly;
  const noPlans = !loadingPlans && !monthly && !annual;

  // Ersparnis Jahres- vs. Monatsabo (z. B. 50 %).
  const savingsPct =
    monthly && annual && monthly.priceAmount > 0
      ? Math.round((1 - annual.priceAmount / (monthly.priceAmount * 12)) * 100)
      : null;

  const trialDays = activePlan?.freeTrialDays ?? monthly?.freeTrialDays ?? annual?.freeTrialDays ?? null;
  const periodWord = selected === 'annual' && annual ? 'Jahr' : 'Monat';

  const handlePurchase = async () => {
    if (busy) return;
    if (!activePlan) {
      Alert.alert('Noch nicht verfügbar', 'Der Kauf ist gerade nicht möglich. Bitte nutze eine aktuelle App-Version und versuche es später erneut.');
      return;
    }
    setBusy(true);
    const outcome = await purchasePlan(activePlan.pkg);
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

  const ctaLabel = busy ? 'Wird verarbeitet…' : trialDays ? `${trialDays} Tage gratis starten` : 'Premium freischalten';

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
              {trialDays ? <Text style={s.trialBanner}>🎁 {trialDays} Tage kostenlos testen</Text> : null}
              {feature && FEATURE_HINT[feature] && (
                <Text style={s.featureHint}>{FEATURE_HINT[feature]}</Text>
              )}

              <ScrollView style={{ maxHeight: 190 }} contentContainerStyle={{ paddingVertical: 6 }} showsVerticalScrollIndicator={false}>
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

              {loadingPlans ? (
                <View style={s.plansLoading}>
                  <ActivityIndicator color={c.primary} />
                  <Text style={s.loadingText}>Preise werden geladen…</Text>
                </View>
              ) : noPlans ? (
                <Text style={s.loadingText}>
                  Käufe sind in dieser Vorschau nicht verfügbar. In der fertigen App kannst du Premium hier abonnieren.
                </Text>
              ) : (
                <View style={s.planRow}>
                  {monthly ? (
                    <PlanCard
                      s={s}
                      label="Monatlich"
                      price={monthly.priceString}
                      sub="pro Monat"
                      selected={selected === 'monthly'}
                      onPress={() => setSelected('monthly')}
                    />
                  ) : null}
                  {annual ? (
                    <PlanCard
                      s={s}
                      label="Jährlich"
                      price={annual.priceString}
                      sub={annual.pricePerMonthString ? `${annual.pricePerMonthString} / Monat` : 'pro Jahr'}
                      badge={savingsPct && savingsPct > 0 ? `${savingsPct}% sparen` : undefined}
                      selected={selected === 'annual'}
                      onPress={() => setSelected('annual')}
                    />
                  ) : null}
                </View>
              )}

              <TouchableOpacity
                style={[s.cta, (busy || loadingPlans || noPlans) && { opacity: 0.6 }]}
                activeOpacity={0.85}
                disabled={busy || loadingPlans || noPlans}
                accessibilityRole="button"
                accessibilityLabel={ctaLabel}
                onPress={handlePurchase}
              >
                <Text style={s.ctaText}>{ctaLabel}</Text>
              </TouchableOpacity>

              <Text style={s.fineprint}>
                {trialDays ? `${trialDays} Tage kostenlos, danach ` : ''}
                {activePlan ? `${activePlan.priceString} / ${periodWord}` : PREMIUM_PRICE}. Das Abo verlängert sich automatisch, bis du kündigst. Die Abrechnung läuft über dein Apple-/Google-Konto. Kündigung jederzeit in dessen Abo-Einstellungen.
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

function PlanCard({
  s, label, price, sub, badge, selected, onPress,
}: {
  s: ReturnType<typeof makeStyles>;
  label: string;
  price: string;
  sub: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.planCard, selected && s.planCardSelected]}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${price}${badge ? ', ' + badge : ''}`}
    >
      {badge ? (
        <View style={s.badge}><Text style={s.badgeText}>{badge}</Text></View>
      ) : null}
      <Text style={[s.planLabel, selected && s.planLabelSelected]}>{label}</Text>
      <Text style={s.planPrice}>{price}</Text>
      <Text style={s.planSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 26 },
    kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 1, color: c.textMuted },
    title: { fontSize: 26, fontWeight: '800', color: c.heading, marginTop: 2 },
    trialBanner: { fontSize: 15, fontWeight: '800', color: c.primary, marginTop: 6 },
    featureHint: { fontSize: 14, fontWeight: '700', color: c.heading, marginTop: 8 },
    row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
    icon: { fontSize: 22, marginRight: 12, marginTop: 1 },
    rowTitle: { fontSize: 15, fontWeight: '700', color: c.heading },
    rowDesc: { fontSize: 13, color: c.textMuted, marginTop: 1, lineHeight: 18 },
    plansLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
    loadingText: { color: c.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 14 },
    planRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    planCard: { flex: 1, borderWidth: 2, borderColor: c.border, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 10, alignItems: 'center', backgroundColor: c.card },
    planCardSelected: { borderColor: c.primary, backgroundColor: c.inputBg },
    planLabel: { fontSize: 14, fontWeight: '700', color: c.textMuted },
    planLabelSelected: { color: c.primary },
    planPrice: { fontSize: 19, fontWeight: '800', color: c.heading, marginTop: 4 },
    planSub: { fontSize: 12, color: c.textMuted, marginTop: 2, textAlign: 'center' },
    badge: { position: 'absolute', top: -11, alignSelf: 'center', backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
    badgeText: { color: c.onPrimary, fontSize: 11, fontWeight: '800' },
    cta: { marginTop: 16, backgroundColor: c.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
    ctaText: { color: c.onPrimary, fontSize: 17, fontWeight: '800' },
    later: { marginTop: 10, alignItems: 'center' },
    laterText: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
    fineprint: { color: c.textMuted, fontSize: 11, lineHeight: 15, marginTop: 12, textAlign: 'center' },
    linksRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8, gap: 8 },
    link: { color: c.primary, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
    linkDot: { color: c.textMuted, fontSize: 13 },
  });
}
