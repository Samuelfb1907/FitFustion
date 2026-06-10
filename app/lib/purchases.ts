// RevenueCat-Anbindung (In-App-Kaeufe). Kapselt das native SDK defensiv:
// laeuft nur auf echten iOS/Android-Builds (nicht in Expo Go / Web) und faellt
// sonst geraeuschlos auf "nicht verfuegbar" zurueck, damit die App ueberall startet.
//
// Test Store: Mit einem test_-Schluessel (EXPO_PUBLIC_REVENUECAT_KEY) laesst sich
// der komplette Kauf testen, OHNE App Store / Play Store. Fuer den echten Store-Build
// die plattform-spezifischen Schluessel eintragen: EXPO_PUBLIC_REVENUECAT_IOS_KEY
// (appl_) und EXPO_PUBLIC_REVENUECAT_ANDROID_KEY (goog_) - diese haben Vorrang.
import { Platform } from 'react-native';
import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';

const RC_KEY =
  (Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY) ||
  process.env.EXPO_PUBLIC_REVENUECAT_KEY ||
  '';

// Diese Kennung muss im RevenueCat-Dashboard exakt als "Entitlement" existieren.
export const PREMIUM_ENTITLEMENT = 'premium';

// Natives Modul -> nur auf Mobilgeraeten. (Web / Expo Go haben kein RevenueCat.)
export const purchasesSupported = Platform.OS === 'ios' || Platform.OS === 'android';

let configured = false;

/** Initialisiert das SDK genau einmal. Gibt false zurueck, wenn nicht moeglich. */
export function configurePurchases(): boolean {
  if (configured) return true;
  if (!purchasesSupported || !RC_KEY) return false;
  try {
    Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: RC_KEY });
    configured = true;
    return true;
  } catch {
    return false;
  }
}

/** Ist in den Kundendaten der Premium-Zugang aktiv? */
export function isPremiumFromInfo(info: CustomerInfo | null | undefined): boolean {
  return !!info?.entitlements?.active?.[PREMIUM_ENTITLEMENT];
}

/** Verknuepft die RevenueCat-Identitaet mit unserem Supabase-Nutzer. */
export async function loginPurchases(userId: string): Promise<CustomerInfo | null> {
  if (!configurePurchases()) return null;
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    return customerInfo;
  } catch {
    return null;
  }
}

export async function logoutPurchases(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    /* ignorieren */
  }
}

/** Holt das Monats-Paket aus dem aktuellen ("current") Offering. */
async function getPremiumPackage(): Promise<PurchasesPackage | null> {
  if (!configurePurchases()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return null;
    return current.monthly ?? current.availablePackages[0] ?? null;
  } catch {
    return null;
  }
}

export type PurchaseOutcome = 'success' | 'cancelled' | 'unavailable' | 'none' | 'error';

/** Startet den echten Kauf des Premium-Abos. */
export async function purchasePremium(): Promise<PurchaseOutcome> {
  if (!configurePurchases()) return 'unavailable';
  const pkg = await getPremiumPackage();
  if (!pkg) return 'unavailable';
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return isPremiumFromInfo(customerInfo) ? 'success' : 'error';
  } catch (e: any) {
    if (e?.userCancelled) return 'cancelled';
    return 'error';
  }
}

/** Stellt fruehere Kaeufe wieder her (Pflicht-Funktion bei Apple). */
export async function restorePurchases(): Promise<PurchaseOutcome> {
  if (!configurePurchases()) return 'unavailable';
  try {
    const info = await Purchases.restorePurchases();
    // Erfolgreich abgefragt, aber kein aktives Abo -> 'none' (echter Fehler ist 'error').
    return isPremiumFromInfo(info) ? 'success' : 'none';
  } catch {
    return 'error';
  }
}

/** Meldet sich bei Aenderungen des Kaufstatus (z. B. direkt nach einem Kauf). */
export function addPremiumListener(cb: (isPremium: boolean) => void): () => void {
  if (!configurePurchases()) return () => {};
  const handler = (info: CustomerInfo) => cb(isPremiumFromInfo(info));
  try {
    Purchases.addCustomerInfoUpdateListener(handler);
    return () => {
      try {
        Purchases.removeCustomerInfoUpdateListener(handler);
      } catch {
        /* ignorieren */
      }
    };
  } catch {
    return () => {};
  }
}
