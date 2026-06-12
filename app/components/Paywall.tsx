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
import { useT, useLang } from '../contexts/LanguageContext';
import LegalText from './LegalText';
import { getTermsSections, getPrivacySections } from '../lib/legal';
import { getPremiumPlans, purchasePlan, restorePurchases, PremiumPlan, PremiumPlans } from '../lib/purchases';

// Anzeige-Fallback, falls der echte Store-Preis (noch) nicht geladen werden kann.
export const PREMIUM_PRICE = '9,99 € / Monat';

// Icon + Übersetzungs-Keys je Vorteil (Texte werden im Render via t() aufgelöst).
const BENEFITS: [string, string, string][] = [
  ['🍽️', 'paywall.benefit.ai.title', 'paywall.benefit.ai.desc'],
  ['📷', 'paywall.benefit.scan.title', 'paywall.benefit.scan.desc'],
  ['🏆', 'paywall.benefit.leaderboard.title', 'paywall.benefit.leaderboard.desc'],
  ['💪', 'paywall.benefit.exercises.title', 'paywall.benefit.exercises.desc'],
  ['⭐', 'paywall.benefit.level.title', 'paywall.benefit.level.desc'],
  ['🗓️', 'paywall.benefit.plan.title', 'paywall.benefit.plan.desc'],
];

// Feature-spezifischer Hinweis oben in der Paywall (Übersetzungs-Keys, im Render via t()).
const FEATURE_HINT: Record<string, string> = {
  ki: 'paywall.featureHint.ki',
  scan: 'paywall.featureHint.scan',
  leaderboard: 'paywall.featureHint.leaderboard',
  level: 'paywall.featureHint.level',
  plan: 'paywall.featureHint.plan',
  exercises: 'paywall.featureHint.exercises',
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
  const t = useT();
  const { lang } = useLang();
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
  const periodWord = selected === 'annual' && annual ? t('paywall.period.year') : t('paywall.period.month');

  const handlePurchase = async () => {
    if (busy) return;
    if (!activePlan) {
      Alert.alert(t('paywall.alert.unavailable.title'), t('paywall.alert.unavailableShort.body'));
      return;
    }
    setBusy(true);
    const outcome = await purchasePlan(activePlan.pkg);
    setBusy(false);
    if (outcome === 'success') {
      close();
      Alert.alert(t('paywall.alert.activated.title'), t('paywall.alert.activated.body'));
    } else if (outcome === 'unavailable') {
      Alert.alert(
        t('paywall.alert.unavailable.title'),
        t('paywall.alert.unavailable.body'),
      );
    } else if (outcome === 'error') {
      Alert.alert(t('paywall.alert.purchaseFailed.title'), t('paywall.alert.tryLater.body'));
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
      Alert.alert(t('paywall.alert.restored.title'), t('paywall.alert.restored.body'));
    } else if (outcome === 'unavailable') {
      Alert.alert(t('paywall.alert.restoreUnavailable.title'), t('paywall.alert.restoreUnavailable.body'));
    } else if (outcome === 'none') {
      Alert.alert(t('paywall.alert.restoreNone.title'), t('paywall.alert.restoreNone.body'));
    } else {
      Alert.alert(t('paywall.alert.restoreFailed.title'), t('paywall.alert.tryLater.body'));
    }
  };

  const ctaLabel = busy ? t('paywall.cta.processing') : trialDays ? t('paywall.cta.startTrial', { n: trialDays }) : t('paywall.cta.unlock');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          {legal ? (
            <>
              <Text style={s.title}>{legal === 'terms' ? t('paywall.legal.termsTitle') : t('paywall.legal.privacyTitle')}</Text>
              <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ paddingVertical: 10 }} showsVerticalScrollIndicator={false}>
                <LegalText c={c} sections={legal === 'terms' ? getTermsSections(lang) : getPrivacySections(lang)} />
              </ScrollView>
              <TouchableOpacity style={s.cta} activeOpacity={0.85} onPress={() => setLegal(null)} accessibilityRole="button" accessibilityLabel={t('paywall.back')}>
                <Text style={s.ctaText}>{t('paywall.back')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.kicker}>FitAvo</Text>
              <Text style={s.title}>{t('paywall.title')}</Text>
              {trialDays ? <Text style={s.trialBanner}>{t('paywall.trialBanner', { n: trialDays })}</Text> : null}
              {feature && FEATURE_HINT[feature] && (
                <Text style={s.featureHint}>{t(FEATURE_HINT[feature])}</Text>
              )}

              <ScrollView style={{ maxHeight: 190 }} contentContainerStyle={{ paddingVertical: 6 }} showsVerticalScrollIndicator={false}>
                {BENEFITS.map(([icon, titleKey, descKey]) => (
                  <View key={titleKey} style={s.row}>
                    <Text style={s.icon}>{icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle}>{t(titleKey)}</Text>
                      <Text style={s.rowDesc}>{t(descKey)}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>

              {loadingPlans ? (
                <View style={s.plansLoading}>
                  <ActivityIndicator color={c.primary} />
                  <Text style={s.loadingText}>{t('paywall.loadingPrices')}</Text>
                </View>
              ) : noPlans ? (
                <Text style={s.loadingText}>
                  {t('paywall.noPlans')}
                </Text>
              ) : (
                <View style={s.planRow}>
                  {monthly ? (
                    <PlanCard
                      s={s}
                      label={t('paywall.plan.monthly.label')}
                      price={monthly.priceString}
                      sub={t('paywall.plan.monthly.sub')}
                      selected={selected === 'monthly'}
                      onPress={() => setSelected('monthly')}
                    />
                  ) : null}
                  {annual ? (
                    <PlanCard
                      s={s}
                      label={t('paywall.plan.annual.label')}
                      price={annual.priceString}
                      sub={annual.pricePerMonthString ? t('paywall.plan.annual.subPerMonth', { p: annual.pricePerMonthString }) : t('paywall.plan.annual.sub')}
                      badge={savingsPct && savingsPct > 0 ? t('paywall.plan.annual.savings', { n: savingsPct }) : undefined}
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
                {trialDays ? t('paywall.fineprint.trialPrefix', { n: trialDays }) : ''}
                {activePlan ? `${activePlan.priceString} / ${periodWord}` : PREMIUM_PRICE}{t('paywall.fineprint.terms')}
              </Text>
              <View style={s.linksRow}>
                <Text style={s.link} onPress={handleRestore}>{t('paywall.restore')}</Text>
              </View>
              <View style={s.linksRow}>
                <Text style={s.link} onPress={() => setLegal('terms')}>{t('paywall.legal.terms')}</Text>
                <Text style={s.linkDot}>·</Text>
                <Text style={s.link} onPress={() => setLegal('privacy')}>{t('paywall.legal.privacy')}</Text>
              </View>

              <TouchableOpacity onPress={close} style={s.later} accessibilityRole="button" accessibilityLabel={t('paywall.close')}>
                <Text style={s.laterText}>{t('paywall.later')}</Text>
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
