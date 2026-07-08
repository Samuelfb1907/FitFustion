// Kalorien-Tracker / Tagebuch (themed): eigene Zutaten auswählen, Menge angeben, Tag tracken.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useKeyboardHeight } from '../lib/useKeyboardHeight';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT, useLang } from '../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { computeNutrition, ageFromBirthDate, Gender, ActivityLevel, GoalType } from '../lib/nutrition';
import BarcodeScanner from '../components/BarcodeScanner';
import { resolveBarcodeFood } from '../lib/barcodeFood';
import { searchOpenFoodFacts, OffSearchItem } from '../lib/openFoodFacts';
import { registerGoodMoment } from '../lib/reviewPrompt';
import { TRACKER_MEALS, MealType, mealByHour, normalizeMeal } from '../lib/meals';
import { getLegalShort } from '../lib/legal';
import { useFocusTick } from '../lib/useFocusTick';
import ErrorRetry from '../components/ErrorRetry';
import { errorMessage } from '../lib/errors';
import { todayStr, daysAgoStr } from '../lib/date';
import { todayTrainingKcal, todayCardioKcal } from '../lib/trainingBonus';
import { hasStepsPermission, getTodayActivity } from '../lib/health';
import BackButton from '../components/BackButton';
import SwipeBack from '../components/SwipeBack';
import { useAndroidBack } from '../lib/useBackHandler';
import Segmented from '../components/Segmented';
import GlassFill from '../components/GlassFill';
import { usePaywall } from '../components/Paywall';
import { parseMeal, parseMealPhoto, ParsedItem } from '../lib/parseMeal';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { foodUnit } from '../lib/foodUnit';
import { foodPortion } from '../lib/foodPortion';
import { TAB_BAR_SPACE } from '../lib/layout';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FREE_FOOD_SEARCHES_PER_DAY, loadFoodSearchCount, bumpFoodSearchCount } from '../lib/foodSearchQuota';
import { CARD_SHADOW as shadow } from '../lib/ui';

type Food = { id: string; name: string; category: string | null; kcal: number; protein: number; carbs: number; fat: number; user_id?: string | null };
type LogEntry = { id: string; amount_g: number; meal_type: string | null; food: Food | null };
type QuickFood = { food: Food; amount: number; count: number };
// Favorit = gespeicherte Mahlzeit (z. B. dein taegliches Fruehstueck) mit mehreren Zutaten.
type FavItem = { food_id: string; name: string; amount_g: number; kcal: number; protein: number; carbs: number; fat: number; unit?: 'g' | 'ml' };
type Favorite = { id: string; name: string; items: FavItem[] };
// "Mein ueblicher Tag": pro Mahlzeit die haeufig zusammen geloggten Lebensmittel.
type UsualItem = { food: Food; amount: number; days: number };
type UsualMeal = { items: UsualItem[]; kcal: number };

// Typische Menge = haeufigste Menge; sonst die zuletzt verwendete.
function typicalAmount(amounts: number[]): number {
  if (!amounts.length) return 100;
  const freq = new Map<number, number>();
  let best = amounts[0];
  let bestCount = 0;
  for (const a of amounts) {
    const n = (freq.get(a) ?? 0) + 1;
    freq.set(a, n);
    if (n > bestCount) { bestCount = n; best = a; }
  }
  return best;
}

// Icon + Farbton je Mahlzeit (statt Emoji), Ionicons-Namen.
const MEAL_ION: Record<MealType, { icon: string; fg: string; bg: string }> = {
  breakfast: { icon: 'sunny', fg: '#F0B429', bg: 'rgba(240,180,41,0.12)' },
  lunch: { icon: 'restaurant', fg: '#4FB8FF', bg: 'rgba(63,169,245,0.12)' },
  dinner: { icon: 'moon', fg: '#C3A8FF', bg: 'rgba(157,123,244,0.14)' },
  snack: { icon: 'nutrition', fg: '#2BD79B', bg: 'rgba(25,201,143,0.12)' },
};

// todayStr -> lib/date.ts

export default function FoodTrackerScreen({ embedded, focusTick, focused = true }: { embedded?: boolean; focusTick?: number; focused?: boolean }) {
  const { session, isPremium } = useAuth();
  const userId = session?.user?.id;
  const { openPaywall } = usePaywall();
  const c = useColors();
  const t = useT();
  const { lang } = useLang();
  const legalShort = getLegalShort(lang);
  const mealLabel = (k: MealType) => t(`food.meal.${k}`);
  const styles = useMemo(() => makeStyles(c), [c]);
  const kb = useKeyboardHeight();

  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  // Open-Food-Facts-Datenbank-Suche (Premium): Treffer + Lade-Status, getrennt von der lokalen Suche.
  const [offResults, setOffResults] = useState<OffSearchItem[]>([]);
  const [offSearching, setOffSearching] = useState(false);
  // Gratis-Kontingent fuer die Datenbank-Suche (pro Kalendertag). offUsed = bereits heute verbrauchte Suchen.
  const [offUsed, setOffUsed] = useState(0);
  // Begriffe, die heute bereits gezaehlt wurden -> derselbe Begriff kostet kein zweites Kontingent.
  const countedQueriesRef = useRef<Set<string>>(new Set());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [targetKcal, setTargetKcal] = useState<number | null>(null);
  const [macroTargets, setMacroTargets] = useState<{ p: number; c: number; f: number } | null>(null);
  const [trainingKcal, setTrainingKcal] = useState(0);
  const [cardioKcal, setCardioKcal] = useState(0);
  const [steps, setSteps] = useState(0);
  const [activityKcal, setActivityKcal] = useState(0);
  const [activityMeasured, setActivityMeasured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'diary' | 'pick' | 'amount' | 'newfood' | 'favnew'>('diary');
  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [amount, setAmount] = useState('100');
  const [amtUnit, setAmtUnit] = useState<'base' | 'portion'>('base');
  const [mealType, setMealType] = useState<MealType>(mealByHour());
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [quickFoods, setQuickFoods] = useState<QuickFood[]>([]);
  const [quickMsg, setQuickMsg] = useState<string | null>(null);
  // Formular "Eigenes Lebensmittel anlegen"
  const [nf, setNf] = useState<{ name: string; cat: string; kcal: string; protein: string; carbs: string; fat: string; unit: 'g' | 'ml' }>({ name: '', cat: '', kcal: '', protein: '', carbs: '', fat: '', unit: 'g' });
  const [savingFood, setSavingFood] = useState(false);
  const [foodErr, setFoodErr] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [backTarget, setBackTarget] = useState<'diary' | 'pick'>('diary'); // wohin "Zurueck" aus dem Mengen-Screen fuehrt
  // Favoriten (Zutaten/Favoriten-Umschalter beim Hinzufuegen)
  const [pickTab, setPickTab] = useState<'zutaten' | 'favoriten'>('zutaten');
  const [addingTo, setAddingTo] = useState<'diary' | 'favorite'>('diary'); // Menge -> Tagebuch oder in Favoriten-Entwurf
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [favDraft, setFavDraft] = useState<{ name: string; items: FavItem[] } | null>(null);
  const [savingFav, setSavingFav] = useState(false);
  const [favErr, setFavErr] = useState<string | null>(null);

  // Android-System-Zurueck: tiefste offene Modus-Ebene zuruecknavigieren (spiegelt die
  // SwipeBack-onBack-Kette). 'diary' ist die Startebene -> false (Fallback in MainTabs).
  // `focused` ist nur true, wenn der Essen-Tab sichtbar UND das Tracker-Segment aktiv ist.
  // pickBack/cancelFavNew sind Funktions-Deklarationen weiter unten (gehoisted).
  useAndroidBack(() => {
    if (mode === 'amount') { setMode(backTarget); return true; }
    if (mode === 'newfood') { setMode('pick'); return true; }
    if (mode === 'favnew') { cancelFavNew(); return true; }
    if (mode === 'pick') { pickBack(); return true; }
    return false;
  }, focused);
  const [favMsg, setFavMsg] = useState<string | null>(null);
  const [usualByMeal, setUsualByMeal] = useState<Partial<Record<MealType, UsualMeal>>>({});
  // "Sprich's einfach": Mahlzeit in Sprache eingeben -> KI erkennt
  const [nlText, setNlText] = useState('');
  const [nlBusy, setNlBusy] = useState(false);
  const [nlErr, setNlErr] = useState<string | null>(null);
  const [nlItems, setNlItems] = useState<ParsedItem[] | null>(null);
  const [nlMeal, setNlMeal] = useState<MealType>(mealByHour());
  const pendingPhotoRef = useRef<string | null>(null); // Foto, das nach erteilter KI-Einwilligung analysiert werden soll
  const [aiConsent, setAiConsent] = useState(false);
  const [aiConsentAsk, setAiConsentAsk] = useState(false);
  useEffect(() => { AsyncStorage.getItem('fitavo.aiConsentAt').then((v) => { if (v) setAiConsent(true); }).catch(() => {}); }, []);
  // Heutigen Verbrauch der Datenbank-Suche laden (nur Gratis-Nutzer; Premium = unbegrenzt).
  useEffect(() => {
    if (isPremium) return;
    loadFoodSearchCount().then(setOffUsed).catch(() => {});
  }, [isPremium]);
  const busyRef = useRef(false); // verhindert doppelte Tagebuch-Eintraege bei schnellem Doppel-Tippen

  useEffect(() => { init(); }, [userId]);

  // Reiter erneut angetippt -> zurueck zum Tagebuch + leise aktualisieren (ohne Spinner)
  useFocusTick(focusTick, () => {
    setMode('diary'); setSelectedFood(null); setSearch(''); setError(null); setScannerOpen(false);
    setPickTab('zutaten'); setAddingTo('diary'); setFavDraft(null);
    init(true);
    // KI-Einwilligung neu einlesen: so greift ein Widerruf (Einstellungen) sofort,
    // sobald man zum Essen-Tab zurueckkehrt – ohne App-Neustart.
    AsyncStorage.getItem('fitavo.aiConsentAt').then((v) => setAiConsent(!!v)).catch(() => {});
  });

  // Serverseitige Lebensmittel-Suche (debounced) – laedt NICHT mehr die ganze foods-Tabelle.
  useEffect(() => {
    if (mode !== 'pick' || !userId) return;
    let cancelled = false;
    const q = search.trim().replace(/[%_]/g, ' ');
    setSearching(true);
    const run = async () => {
      let query = supabase.from('foods').select('id, name, category, kcal, protein, carbs, fat, user_id');
      if (q) query = query.ilike('name', `%${q}%`);
      const { data } = await query.order('name').limit(2000);
      if (cancelled) return;
      setSearchResults((data ?? []) as Food[]);
      setSearching(false);
    };
    const t = setTimeout(run, q ? 280 : 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, mode, userId]);

  // Premium: zusaetzlich die Open-Food-Facts-Datenbank per Freitext durchsuchen.
  // Laeuft getrennt von der lokalen Suche (Netz), etwas spaeter entprellt, nur im
  // Zutaten-Tab und ab 2 Zeichen. Gratis-Nutzer loesen das nicht aus (kein Netz-Call).
  useEffect(() => {
    const onIngredients = addingTo === 'favorite' || pickTab === 'zutaten';
    if (mode !== 'pick' || !onIngredients) { setOffResults([]); setOffSearching(false); return; }
    const q = search.trim();
    if (q.length < 2) { setOffResults([]); setOffSearching(false); return; }
    // Gratis-Nutzer: nur suchen, wenn entweder dieser Begriff heute schon gezaehlt wurde
    // (Wiederholung kostet nichts) oder noch Kontingent frei ist. Sonst kein Netz-Call -> Upsell.
    const qKey = q.toLowerCase();
    if (!isPremium) {
      const alreadyCounted = countedQueriesRef.current.has(qKey);
      if (!alreadyCounted && offUsed >= FREE_FOOD_SEARCHES_PER_DAY) {
        setOffResults([]); setOffSearching(false); return;
      }
    }
    let cancelled = false;
    setOffSearching(true);
    const run = async () => {
      // Kontingent erst jetzt verbrauchen (nur Gratis, nur neuer Begriff).
      if (!isPremium && !countedQueriesRef.current.has(qKey)) {
        countedQueriesRef.current.add(qKey);
        const n = await bumpFoodSearchCount();
        if (!cancelled) setOffUsed(n);
      }
      const items = await searchOpenFoodFacts(q, lang === 'en' ? 'en' : 'de');
      if (cancelled) return;
      setOffResults(items);
      setOffSearching(false);
    };
    const id = setTimeout(run, 500);
    return () => { cancelled = true; clearTimeout(id); };
  }, [search, mode, isPremium, pickTab, addingTo, lang, offUsed]);

  async function handleScanned(code: string) {
    setScannerOpen(false);
    if (!userId) return;
    setScanning(true);
    setError(null);
    const res = await resolveBarcodeFood(userId, code);
    setScanning(false);
    if (!res.food) {
      // Klar sichtbares Pop-up statt kleiner Fehlerzeile unten (leicht zu uebersehen).
      if (res.reason === 'not_found') {
        Alert.alert(
          t('food.barcodeNotFoundTitle'),
          t('food.barcodeNotFoundBody', { code }),
          [
            { text: t('food.searchManually'), onPress: () => openPick(mealByHour()) },
            { text: t('food.ok'), style: 'cancel' },
          ],
        );
      } else {
        Alert.alert(t('food.barcodeErrorTitle'), t('food.barcodeFetchFailed'), [{ text: t('food.ok') }]);
      }
      return;
    }
    const food = res.food;
    setSelectedFood(food);
    setAmount('100');
    setMealType(mealByHour());
    setBackTarget('diary'); // vom Scan kam man aus dem Tagebuch -> dorthin zurueck
    setMode('amount');
  }

  // Treffer aus der Datenbank-Suche -> wie ein Scan zu einem Lebensmittel aufloesen -> Mengen-Screen.
  async function handlePickOff(item: OffSearchItem) {
    if (!userId || scanning) return;
    setScanning(true);
    setError(null);
    const res = await resolveBarcodeFood(userId, item.code, 'Datenbank');
    setScanning(false);
    if (!res.food) { setError(t('food.barcodeFetchFailed')); return; }
    setSelectedFood(res.food);
    setAmount('100');
    setBackTarget('pick'); // aus der Suche kam man -> dorthin zurueck (addingTo bleibt erhalten)
    setMode('amount');
  }

  async function init(silent = false) {
    if (!userId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
    const { data: prof } = await supabase.from('profiles').select('weight_kg, height_cm, birth_date, gender, activity_level, custom_calories').eq('id', userId).maybeSingle();
    const { data: goal } = await supabase.from('goals').select('goal_type').eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (prof && prof.weight_kg && prof.height_cm) {
      const t = computeNutrition({
        weightKg: Number(prof.weight_kg), heightCm: Number(prof.height_cm), age: ageFromBirthDate(prof.birth_date),
        gender: (prof.gender ?? 'prefer_not') as Gender, activity: (prof.activity_level ?? 'moderate') as ActivityLevel, goal: (goal?.goal_type ?? 'general_fitness') as GoalType,
      }, prof.custom_calories);
      setTargetKcal(t.targetCalories);
      setMacroTargets({ p: t.proteinG, c: t.carbsG, f: t.fatG });
      setTrainingKcal(await todayTrainingKcal(userId, Number(prof.weight_kg)));
      setCardioKcal(await todayCardioKcal(userId));
      if (await hasStepsPermission()) {
        const a = await getTodayActivity(Number(prof.weight_kg));
        setSteps(a.steps); setActivityKcal(a.kcal); setActivityMeasured(a.measured);
      } else { setSteps(0); setActivityKcal(0); setActivityMeasured(false); }
    }
    await loadLogs();
    await loadQuick();
    await loadFavorites();
    await loadUsual();
    setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    init(true);
  }

  async function loadLogs() {
    if (!userId) return;
    const { data, error } = await supabase.from('food_logs').select('id, amount_g, meal_type, foods(id, name, category, kcal, protein, carbs, fat)').eq('user_id', userId).eq('log_date', todayStr()).order('created_at');
    if (error) throw error; // Fehler nicht verschlucken -> sonst zeigt das Tagebuch faelschlich 0 kcal
    setLogs((data ?? []).map((row: any) => ({ id: row.id, amount_g: row.amount_g, meal_type: row.meal_type ?? null, food: Array.isArray(row.foods) ? row.foods[0] : row.foods })));
  }

  // Haeufigste/zuletzt genutzte Lebensmittel aus der Historie fuer den Schnellzugriff
  async function loadQuick() {
    if (!userId) return;
    const { data, error } = await supabase
      .from('food_logs')
      .select('amount_g, foods(id, name, category, kcal, protein, carbs, fat, user_id)')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(120);
    if (error) throw error;
    const map = new Map<string, { food: Food; amount: number; count: number; order: number }>();
    ((data ?? []) as any[]).forEach((row, idx) => {
      const food = Array.isArray(row.foods) ? row.foods[0] : row.foods;
      if (!food) return;
      const ex = map.get(food.id);
      if (ex) ex.count += 1;
      else map.set(food.id, { food, amount: row.amount_g ?? 100, count: 1, order: idx });
    });
    const list = [...map.values()]
      .sort((a, b) => b.count - a.count || a.order - b.order)
      .slice(0, 8)
      .map((x) => ({ food: x.food, amount: x.amount, count: x.count }));
    setQuickFoods(list);
  }

  // "Mein ueblicher Tag": aus ~35 Tagen Historie pro Mahlzeit die Lebensmittel,
  // die an mind. 2 Tagen geloggt wurden (= ueblich). Rein clientseitig, ohne KI.
  async function loadUsual() {
    if (!userId) { setUsualByMeal({}); return; }
    const { data, error } = await supabase
      .from('food_logs')
      .select('meal_type, amount_g, log_date, foods(id, name, category, kcal, protein, carbs, fat, user_id)')
      .eq('user_id', userId).gte('log_date', daysAgoStr(35)).order('created_at', { ascending: false }).limit(400);
    if (error) throw error;
    const byMeal: Record<string, Map<string, { food: Food; days: Set<string>; amounts: number[] }>> = {};
    ((data ?? []) as any[]).forEach((row) => {
      const food = Array.isArray(row.foods) ? row.foods[0] : row.foods;
      if (!food) return;
      const meal = normalizeMeal(row.meal_type);
      if (!byMeal[meal]) byMeal[meal] = new Map();
      const m = byMeal[meal];
      const amt = Number(row.amount_g) || 100;
      const ex = m.get(food.id);
      if (ex) { ex.days.add(String(row.log_date)); ex.amounts.push(amt); }
      else m.set(food.id, { food: food as Food, days: new Set([String(row.log_date)]), amounts: [amt] });
    });
    const result: Partial<Record<MealType, UsualMeal>> = {};
    (Object.keys(byMeal) as MealType[]).forEach((meal) => {
      const items = [...byMeal[meal].values()]
        .filter((x) => x.days.size >= 2)
        .sort((a, b) => b.days.size - a.days.size)
        .slice(0, 6)
        .map((x) => ({ food: x.food, amount: typicalAmount(x.amounts), days: x.days.size }));
      if (items.length) {
        const kcal = items.reduce((s, it) => s + Math.round((it.food.kcal * it.amount) / 100), 0);
        result[meal] = { items, kcal };
      }
    });
    setUsualByMeal(result);
  }

  // Alle ueblichen Items einer Mahlzeit mit EINEM Tipp ins heutige Tagebuch.
  async function addUsual(meal: MealType) {
    if (!userId || busyRef.current) return;
    const u = usualByMeal[meal];
    if (!u || !u.items.length) return;
    busyRef.current = true; setQuickMsg(null);
    try {
      const rows = u.items.map((it) => ({ user_id: userId, food_id: it.food.id, amount_g: it.amount, log_date: todayStr(), meal_type: meal }));
      const { error: e } = await supabase.from('food_logs').insert(rows);
      if (e) { setError(errorMessage(e)); return; }
      setQuickMsg(t('food.usualAdded', { meal: mealLabel(meal) }));
      setTimeout(() => setQuickMsg(null), 2500);
      await init(true);
      registerGoodMoment(); // positiver Moment: tägliche Routine mit 1 Tipp geloggt
    } finally { busyRef.current = false; }
  }

  // ---- "Sprich's einfach": Satz -> (Einwilligung) -> KI-Erkennung -> Bestaetigung -> Tagebuch ----
  // Vor der ERSTEN KI-Nutzung holen wir eine ausdrueckliche Einwilligung (Art. 9 DSGVO,
  // Drittland-Uebermittlung des Freitexts an Anthropic/USA). Nachweis: lokal + serverseitig.
  async function recognizeMeal() {
    if (!isPremium) { openPaywall('ki'); return; }
    if (!nlText.trim() || nlBusy) return;
    if (!aiConsent) { setAiConsentAsk(true); return; }
    await runRecognize();
  }
  async function acceptAiConsent() {
    const now = new Date().toISOString();
    setAiConsent(true);
    setAiConsentAsk(false);
    try { await AsyncStorage.setItem('fitavo.aiConsentAt', now); } catch {}
    if (userId) supabase.from('profiles').update({ ai_consent_at: now }).eq('id', userId).then(() => {}, () => {});
    // Nach der Einwilligung die wartende Aktion ausfuehren: Foto (falls gemerkt) sonst Text.
    const pendingPhoto = pendingPhotoRef.current;
    if (pendingPhoto) { pendingPhotoRef.current = null; runRecognizePhoto(pendingPhoto); }
    else runRecognize();
  }
  async function runRecognize() {
    const text = nlText.trim();
    if (!text || nlBusy) return;
    setNlBusy(true); setNlErr(null);
    try {
      const items = await parseMeal(text, mealByHour(), lang);
      if (!items.length) { setNlErr(t('food.nlNothingRecognized')); return; }
      const m = items[0]?.meal_type ?? mealByHour();
      setNlMeal(m);
      setNlItems(items.map((it) => ({ ...it, meal_type: m })));
    } catch (e) {
      const code = (e as any)?.code;
      if (code === 'premium_required') { openPaywall('ki'); return; }
      const msg = code === 'rate_limited'
        ? (e as Error).message
        : t('food.nlUnavailable');
      setNlErr(msg);
    } finally {
      setNlBusy(false);
    }
  }
  // ---- Foto -> KI-Erkennung (nutzt dieselbe Bestaetigungs-Liste wie der Text-Modus) ----
  async function recognizeMealPhoto() {
    if (!isPremium) { openPaywall('ki'); return; }
    if (nlBusy) return;
    Alert.alert(t('food.photoChooseTitle'), undefined, [
      { text: t('food.photoCamera'), onPress: () => pickMealImage('camera') },
      { text: t('food.photoGallery'), onPress: () => pickMealImage('library') },
      { text: t('food.photoCancel'), style: 'cancel' },
    ]);
  }
  async function pickMealImage(source: 'camera' | 'library') {
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { setNlErr(t('food.photoNoCamera')); return; }
      }
      const res = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (res.canceled || !res.assets?.length) return;
      // Verkleinern + komprimieren -> kleines Base64 (schnell + guenstig); Qualitaet fuer die Erkennung reicht.
      const manip = await ImageManipulator.manipulateAsync(
        res.assets[0].uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      const base64 = manip.base64;
      if (!base64) { setNlErr(t('food.photoFailed')); return; }
      if (!aiConsent) { pendingPhotoRef.current = base64; setAiConsentAsk(true); return; }
      await runRecognizePhoto(base64);
    } catch {
      setNlErr(t('food.photoFailed'));
    }
  }
  async function runRecognizePhoto(base64: string) {
    if (nlBusy) return;
    setNlBusy(true); setNlErr(null);
    try {
      const items = await parseMealPhoto(base64, 'image/jpeg', mealByHour(), lang);
      if (!items.length) { setNlErr(t('food.photoNothing')); return; }
      const m = items[0]?.meal_type ?? mealByHour();
      setNlMeal(m);
      setNlItems(items.map((it) => ({ ...it, meal_type: m })));
    } catch (e) {
      const code = (e as any)?.code;
      if (code === 'premium_required') { openPaywall('ki'); return; }
      const msg = code === 'rate_limited' ? (e as Error).message : t('food.nlUnavailable');
      setNlErr(msg);
    } finally {
      setNlBusy(false);
    }
  }
  // Mahlzeit fuer alle erkannten Eintraege im Bestaetigungs-Dialog waehlen.
  function setNlMealAll(meal: MealType) {
    setNlMeal(meal);
    setNlItems((cur) => (cur ?? []).map((it) => ({ ...it, meal_type: meal })));
  }
  // Menge (Gramm) eines erkannten Eintrags im Bestaetigungs-Dialog anpassen.
  function setNlAmount(idx: number, text: string) {
    const digits = text.replace(/[^0-9]/g, '');
    const n = Math.min(100000, parseInt(digits || '0', 10) || 0);
    setNlItems((cur) => (cur ?? []).map((it, i) => (i === idx ? { ...it, amount_g: n } : it)));
  }
  // Erkannte Eintraege ins Tagebuch: vorhandenes Lebensmittel abgleichen, sonst neu anlegen.
  async function applyNlItems() {
    if (!userId || !nlItems || !nlItems.length || busyRef.current) return;
    busyRef.current = true; setNlBusy(true); setNlErr(null);
    try {
      const rows: any[] = [];
      for (const it of nlItems) {
        let foodId: string | null = null;
        const { data: exact } = await supabase.from('foods').select('id').ilike('name', it.name).limit(1);
        if (exact && exact.length) foodId = exact[0].id;
        if (!foodId) {
          const { data: like } = await supabase.from('foods').select('id').ilike('name', `%${it.name}%`).order('name').limit(1);
          if (like && like.length) foodId = like[0].id;
        }
        if (!foodId) {
          const { data: created, error: cErr } = await supabase.from('foods')
            .insert({ name: it.name, category: foodUnit({ name: it.name }) === 'ml' ? 'Getränke' : 'KI-erkannt', kcal: it.kcal, protein: it.protein, carbs: it.carbs, fat: it.fat, user_id: userId })
            .select('id').single();
          if (!cErr && created) foodId = created.id;
          else {
            const { data: again } = await supabase.from('foods').select('id').ilike('name', it.name).limit(1);
            if (again && again.length) foodId = again[0].id;
          }
        }
        if (foodId) rows.push({ user_id: userId, food_id: foodId, amount_g: it.amount_g, log_date: todayStr(), meal_type: it.meal_type });
      }
      if (rows.length) {
        const { error } = await supabase.from('food_logs').insert(rows);
        if (error) { setNlErr(t('food.nlInsertFailed', { msg: error.message ?? '' })); return; }
      }
      setNlItems(null); setNlText('');
      await init(true);
    } finally {
      setNlBusy(false); busyRef.current = false;
    }
  }

  async function quickAdd(qf: QuickFood) {
    if (!userId || busyRef.current) return;
    busyRef.current = true;
    setQuickMsg(null);
    try {
      const { error: e } = await supabase.from('food_logs').insert({ user_id: userId, food_id: qf.food.id, amount_g: qf.amount, log_date: todayStr(), meal_type: mealByHour() });
      if (e) { setError(errorMessage(e)); return; }
      setQuickMsg(t('food.foodAdded', { name: qf.food.name, amount: qf.amount, unit: foodUnit(qf.food) }));
      setTimeout(() => setQuickMsg(null), 2500);
      await init(true);
    } finally {
      busyRef.current = false;
    }
  }

  // Oeffnet den Mengen-Screen mit sinnvollen Defaults: hat das Lebensmittel eine
  // Haushalts-Portion (z. B. "Stueck"), starten wir bei 1 Stueck, sonst bei 100 g.
  function openAmount(food: Food) {
    const p = foodPortion(food);
    setSelectedFood(food);
    setAmtUnit(p ? 'portion' : 'base');
    setAmount(p ? '1' : '100');
    setError(null);
    setBackTarget('pick');
    setMode('amount');
  }

  async function addLog() {
    if (!userId || !selectedFood || busyRef.current) return;
    const n = Number(amount.replace(',', '.'));
    if (!n || n <= 0) { setError(t('food.invalidAmount')); return; }
    const portion = foodPortion(selectedFood);
    const grams = amtUnit === 'portion' && portion ? n * portion.grams : n;
    // Beim Erstellen eines Favoriten: Zutat in den Entwurf legen statt ins Tagebuch.
    if (addingTo === 'favorite') {
      const food = selectedFood;
      setFavDraft((d) => {
        const base = d ?? { name: '', items: [] };
        return { name: base.name, items: [...base.items, { food_id: food.id, name: food.name, amount_g: grams, kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat, unit: foodUnit(food) }] };
      });
      setSelectedFood(null); setAmount('100'); setAmtUnit('base'); setError(null); setSearch(''); setMode('favnew');
      return;
    }
    busyRef.current = true;
    setSaving(true); setError(null);
    const addedName = selectedFood.name;
    const addedUnit = amtUnit === 'portion' && portion ? t(portion.unitKey) : foodUnit(selectedFood);
    try {
      const { error: e } = await supabase.from('food_logs').insert({ user_id: userId, food_id: selectedFood.id, amount_g: grams, log_date: todayStr(), meal_type: mealType });
      if (e) { setError(errorMessage(e)); return; }
      setSelectedFood(null); setAmount('100'); setAmtUnit('base'); setSearch(''); setMode('diary');
      setQuickMsg(t('food.foodAdded', { name: addedName, amount: n, unit: addedUnit }));
      setTimeout(() => setQuickMsg(null), 2500);
      await init(true);
    } finally {
      setSaving(false);
      busyRef.current = false;
    }
  }

  // ---- Favoriten (gespeicherte Mahlzeiten) ----------------------------------
  async function loadFavorites() {
    if (!userId) return;
    const { data, error } = await supabase.from('meal_favorites').select('id, name, items').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    setFavorites((data ?? []).map((r: any) => ({ id: r.id, name: r.name, items: Array.isArray(r.items) ? (r.items as FavItem[]) : [] })));
  }

  const favKcal = (fav: Favorite) => fav.items.reduce((s, it) => s + Math.round((it.kcal * it.amount_g) / 100), 0);

  // Zutatenauswahl aus dem Tagebuch oeffnen (normaler Weg, Tab "Zutaten").
  function openPick(meal: MealType) {
    setMealType(meal); setError(null); setSearch(''); setAddingTo('diary'); setPickTab('zutaten'); setMode('pick');
  }
  // "Zurueck" aus der Zutatenauswahl: beim Favoriten-Bau zurueck zum Entwurf, sonst ins Tagebuch.
  function pickBack() {
    setSearch('');
    if (addingTo === 'favorite') setMode('favnew');
    else setMode('diary');
  }

  function startNewFavorite() {
    setFavDraft({ name: '', items: [] }); setFavErr(null); setAddingTo('favorite'); setMode('favnew');
  }
  // Bereits geloggte Mahlzeit nachtraeglich als Favorit speichern: Eintraege -> Entwurf (umbenennbar).
  function saveMealAsFavorite(meal: MealType, entries: LogEntry[]) {
    const favItems: FavItem[] = [];
    for (const e of entries) {
      if (!e.food) continue;
      favItems.push({ food_id: e.food.id, name: e.food.name, amount_g: e.amount_g, kcal: e.food.kcal, protein: e.food.protein, carbs: e.food.carbs, fat: e.food.fat, unit: foodUnit(e.food) });
    }
    if (!favItems.length) return;
    setFavErr(null);
    setFavDraft({ name: mealLabel(meal), items: favItems });
    setAddingTo('favorite');
    setMode('favnew');
  }
  function cancelFavNew() {
    setFavDraft(null); setAddingTo('diary'); setPickTab('favoriten'); setMode('pick');
  }
  function addItemToFavorite() {
    setAddingTo('favorite'); setSearch(''); setPickTab('zutaten'); setMode('pick');
  }
  function removeDraftItem(idx: number) {
    setFavDraft((d) => (d ? { name: d.name, items: d.items.filter((_, i) => i !== idx) } : d));
  }
  async function saveFavorite() {
    if (!userId || !favDraft) return;
    const name = favDraft.name.trim();
    if (!name) { setFavErr(t('food.errEnterName')); return; }
    if (favDraft.items.length === 0) { setFavErr(t('food.errAtLeastOneItem')); return; }
    setSavingFav(true); setFavErr(null);
    const { error } = await supabase.from('meal_favorites').insert({ user_id: userId, name, items: favDraft.items });
    setSavingFav(false);
    if (error) { setFavErr(t('food.errSaveFailed', { msg: error.message ?? '' })); return; }
    setFavDraft(null); setAddingTo('diary'); setPickTab('favoriten'); setMode('pick');
    await init(true);
  }
  // Favorit anwenden: alle Zutaten auf einmal in die gewaehlte Mahlzeit eintragen.
  async function applyFavorite(fav: Favorite) {
    if (!userId || busyRef.current || !fav.items.length) return;
    busyRef.current = true; setFavMsg(null);
    try {
      const rows = fav.items.map((it) => ({ user_id: userId, food_id: it.food_id, amount_g: it.amount_g, log_date: todayStr(), meal_type: mealType }));
      const { error: e } = await supabase.from('food_logs').insert(rows);
      if (e) { setError(t('food.errApplyFavorite')); setMode('diary'); return; }
      setMode('diary'); setSearch('');
      await init(true);
      registerGoodMoment(); // positiver Moment: gespeicherte Mahlzeit angewendet
    } finally { busyRef.current = false; }
  }
  function confirmDeleteFavorite(fav: Favorite) {
    Alert.alert(t('food.deleteFavoriteTitle'), t('food.deleteFavoriteMsg', { name: fav.name }), [
      { text: t('food.cancel'), style: 'cancel' },
      { text: t('food.delete'), style: 'destructive', onPress: () => doDeleteFavorite(fav.id) },
    ]);
  }
  async function doDeleteFavorite(id: string) {
    const { error } = await supabase.from('meal_favorites').delete().eq('id', id);
    if (error) { Alert.alert(t('food.notPossible'), errorMessage(error)); return; }
    await init(true);
  }

  function deleteLog(id: string) {
    Alert.alert(t('food.deleteEntryTitle'), t('food.deleteEntryMsg'), [
      { text: t('food.cancel'), style: 'cancel' },
      { text: t('food.delete'), style: 'destructive', onPress: () => doDeleteLog(id) },
    ]);
  }
  async function doDeleteLog(id: string) {
    const { error } = await supabase.from('food_logs').delete().eq('id', id);
    if (error) { Alert.alert(t('food.notPossible'), errorMessage(error)); return; }
    await init(true);
  }

  function openNewFood() {
    setNf({ name: search.trim(), cat: '', kcal: '', protein: '', carbs: '', fat: '', unit: 'g' });
    setFoodErr(null);
    setMode('newfood');
  }

  async function saveFood() {
    if (!userId) return;
    const name = nf.name.trim();
    const kcal = Number(nf.kcal.replace(',', '.'));
    if (!name) { setFoodErr(t('food.errEnterName')); return; }
    if (!kcal || kcal <= 0) { setFoodErr(t('food.errInvalidKcal')); return; }
    if (kcal > 1000) { setFoodErr(t('food.errKcalTooHigh')); return; }
    const num = (s: string) => Math.max(0, Number(s.replace(',', '.')) || 0);
    const protein = num(nf.protein), carbs = num(nf.carbs), fat = num(nf.fat);
    if (protein > 100 || carbs > 100 || fat > 100) { setFoodErr(t('food.errMacroTooHigh')); return; }
    setSavingFood(true); setFoodErr(null);
    const { data, error } = await supabase
      .from('foods')
      .insert({ name, category: nf.unit === 'ml' ? 'Getränke' : (nf.cat.trim() || 'Eigene'), kcal, protein, carbs, fat, user_id: userId })
      .select('id, name, category, kcal, protein, carbs, fat, user_id')
      .single();
    setSavingFood(false);
    if (error || !data) {
      setFoodErr((error as any)?.code === '23505'
        ? t('food.errDuplicateFood')
        : t('food.errSaveFailed', { msg: error?.message ?? '' }));
      return;
    }
    const food = data as Food;
    openAmount(food);
  }

  function confirmDeleteFood(food: Food) {
    Alert.alert(t('food.deleteFoodTitle'), t('food.deleteFoodMsg', { name: food.name }), [
      { text: t('food.cancel'), style: 'cancel' },
      { text: t('food.delete'), style: 'destructive', onPress: () => doDeleteFood(food.id) },
    ]);
  }
  async function doDeleteFood(id: string) {
    const { error } = await supabase.from('foods').delete().eq('id', id);
    if (error) {
      Alert.alert(t('food.notPossible'), t('food.errFoodInUse'));
      return;
    }
    setSearchResults((prev) => prev.filter((f) => f.id !== id));
  }

  const kcalOf = (e: LogEntry) => (e.food ? Math.round((e.food.kcal * e.amount_g) / 100) : 0);
  const macroPct = (v: number, target?: number) => (target && target > 0 ? Math.min(100, Math.round((v / target) * 100)) : 0);
  // Summen in EINEM Durchlauf (memoisiert) statt 4x ueber die Liste zu iterieren
  const { totalKcal, totalP, totalC, totalF } = useMemo(() => {
    let kcal = 0, p = 0, cc = 0, f = 0;
    for (const e of logs) {
      if (!e.food) continue;
      kcal += Math.round((e.food.kcal * e.amount_g) / 100);
      p += (e.food.protein * e.amount_g) / 100;
      cc += (e.food.carbs * e.amount_g) / 100;
      f += (e.food.fat * e.amount_g) / 100;
    }
    return { totalKcal: kcal, totalP: Math.round(p), totalC: Math.round(cc), totalF: Math.round(f) };
  }, [logs]);
  const effTarget = targetKcal != null ? targetKcal + trainingKcal + activityKcal + cardioKcal : null;
  const remaining = effTarget != null ? effTarget - totalKcal : null;

  if (loading) {
    return (<View style={[styles.container, embedded && styles.embedded]}>{!embedded && <Text style={styles.title}>{t('food.title')}</Text>}<ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} /></View>);
  }

  if (loadError) {
    return (
      <View style={[styles.container, embedded && styles.embedded]}>
        {!embedded && <Text style={styles.title}>{t('food.title')}</Text>}
        <ErrorRetry message={loadError} onRetry={() => init()} embedded={embedded} />
      </View>
    );
  }

  if (scanning) {
    return (
      <View style={[styles.container, embedded && styles.embedded]}>
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 60 }} />
        <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 14 }]}>{t('food.searchingProduct')}</Text>
      </View>
    );
  }

  if (mode === 'amount' && selectedFood) {
    const portion = foodPortion(selectedFood);
    const n = Number(amount.replace(',', '.')) || 0;
    const grams = amtUnit === 'portion' && portion ? n * portion.grams : n;
    const previewKcal = Math.round((selectedFood.kcal * grams) / 100);
    const unit = foodUnit(selectedFood);
    return (
      <SwipeBack key="food-amount" onBack={() => setMode(backTarget)} c={c} behind={backTarget === 'pick' ? renderPick() : renderDiary()}>
        <ScrollView style={[styles.container, embedded && styles.embedded]} contentContainerStyle={{ paddingBottom: embedded ? TAB_BAR_SPACE : 24 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <BackButton onPress={() => setMode(backTarget)} c={c} />
          <Text style={styles.title}>{selectedFood.name}</Text>
          <Text style={styles.subtitle}>{t('food.kcalPer100g', { n: selectedFood.kcal, unit })}</Text>
          {portion && (
            <View style={[styles.mealChips, { marginBottom: 4 }]}>
              <TouchableOpacity style={[styles.mealChip, amtUnit === 'portion' && styles.mealChipActive]} onPress={() => { if (amtUnit === 'portion') return; const g = Number(amount.replace(',', '.')) || portion.grams; setAmtUnit('portion'); setAmount(String(Math.max(1, Math.round(g / portion.grams)))); }} activeOpacity={0.8} accessibilityRole="button">
                <Text style={[styles.mealChipText, amtUnit === 'portion' && styles.mealChipTextActive]}>{t(portion.unitKey)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mealChip, amtUnit === 'base' && styles.mealChipActive]} onPress={() => { if (amtUnit === 'base') return; const cnt = Number(amount.replace(',', '.')) || 1; setAmtUnit('base'); setAmount(String(Math.round(cnt * portion.grams))); }} activeOpacity={0.8} accessibilityRole="button">
                <Text style={[styles.mealChipText, amtUnit === 'base' && styles.mealChipTextActive]}>{unit}</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.inputLabel}>{amtUnit === 'portion' && portion ? t('food.amountCount') : t('food.amountInGrams', { unit })}</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" inputMode="decimal" placeholder={amtUnit === 'portion' && portion ? '1' : t('food.amountPlaceholder')} placeholderTextColor={c.textMuted} returnKeyType="done" onSubmitEditing={addLog} />
          <Text style={styles.preview}>{amtUnit === 'portion' && portion ? `${t('food.approxGrams', { n: Math.round(grams) })}  ·  ${previewKcal} kcal` : `= ${previewKcal} kcal`}</Text>
          {addingTo !== 'favorite' && (
            <>
              <Text style={styles.inputLabel}>{t('food.meal')}</Text>
              <View style={styles.mealChips}>
                {TRACKER_MEALS.map((m) => (
                  <TouchableOpacity key={m.key} style={[styles.mealChip, mealType === m.key && styles.mealChipActive]} onPress={() => setMealType(m.key)} activeOpacity={0.8}>
                    <Text style={[styles.mealChipText, mealType === m.key && styles.mealChipTextActive]}>{mealLabel(m.key)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={addLog} disabled={saving}>
            {saving ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.primaryText}>{addingTo === 'favorite' ? t('food.addToFavoriteList') : t('food.addToDiary')}</Text>}
          </TouchableOpacity>
          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      </SwipeBack>
    );
  }

  if (mode === 'newfood') {
    return (
      <SwipeBack key="food-newfood" onBack={() => setMode('pick')} c={c} behind={renderPick()}>
      <ScrollView style={[styles.container, embedded && styles.embedded]} contentContainerStyle={{ paddingBottom: embedded ? TAB_BAR_SPACE : 24 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <BackButton onPress={() => setMode('pick')} c={c} />
        <Text style={styles.title}>{t('food.newFoodTitle')}</Text>
        <Text style={styles.subtitle}>{t('food.nutritionPer100g', { unit: nf.unit })}</Text>
        <Text style={styles.inputLabel}>{t('food.name')}</Text>
        <TextInput style={styles.input} value={nf.name} onChangeText={(v) => setNf({ ...nf, name: v })} placeholder={t('food.namePlaceholder')} placeholderTextColor={c.textMuted} />
        <Text style={styles.inputLabel}>{t('food.unitLabel')}</Text>
        <View style={styles.mealChips}>
          {(['g', 'ml'] as const).map((u) => (
            <TouchableOpacity key={u} style={[styles.mealChip, nf.unit === u && styles.mealChipActive]} onPress={() => setNf({ ...nf, unit: u })} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ selected: nf.unit === u }}>
              <Text style={[styles.mealChipText, nf.unit === u && styles.mealChipTextActive]}>{u === 'g' ? t('food.unitG') : t('food.unitMl')}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {nf.unit === 'ml' ? (
          <Text style={styles.unitHint}>{t('food.unitHintMl')}</Text>
        ) : (
          <>
            <Text style={styles.inputLabel}>{t('food.categoryOptional')}</Text>
            <TextInput style={styles.input} value={nf.cat} onChangeText={(v) => setNf({ ...nf, cat: v })} placeholder={t('food.categoryPlaceholder')} placeholderTextColor={c.textMuted} />
          </>
        )}
        <Text style={styles.inputLabel}>{t('food.calories')}</Text>
        <TextInput style={styles.input} value={nf.kcal} onChangeText={(v) => setNf({ ...nf, kcal: v })} keyboardType="numeric" placeholder={t('food.per100g', { unit: nf.unit })} placeholderTextColor={c.textMuted} />
        <View style={styles.macroRow}>
          <View style={styles.macroCol}>
            <Text style={styles.inputLabel}>{t('food.protein')}</Text>
            <TextInput style={styles.input} value={nf.protein} onChangeText={(v) => setNf({ ...nf, protein: v })} keyboardType="numeric" placeholder="0" placeholderTextColor={c.textMuted} />
          </View>
          <View style={styles.macroCol}>
            <Text style={styles.inputLabel}>{t('food.carbs')}</Text>
            <TextInput style={styles.input} value={nf.carbs} onChangeText={(v) => setNf({ ...nf, carbs: v })} keyboardType="numeric" placeholder="0" placeholderTextColor={c.textMuted} />
          </View>
          <View style={styles.macroCol}>
            <Text style={styles.inputLabel}>{t('food.fat')}</Text>
            <TextInput style={styles.input} value={nf.fat} onChangeText={(v) => setNf({ ...nf, fat: v })} keyboardType="numeric" placeholder="0" placeholderTextColor={c.textMuted} />
          </View>
        </View>
        <TouchableOpacity style={[styles.primaryBtn, savingFood && { opacity: 0.6 }]} onPress={saveFood} disabled={savingFood}>
          {savingFood ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.primaryText}>{t('food.saveAndSelect')}</Text>}
        </TouchableOpacity>
        {foodErr && <Text style={styles.error}>{foodErr}</Text>}
      </ScrollView>
      </SwipeBack>
    );
  }

  if (mode === 'pick') {
    return (
      <SwipeBack key="food-pick" onBack={pickBack} c={c} behind={addingTo === 'favorite' ? renderFavNew() : renderDiary()}>
        {renderPick()}
      </SwipeBack>
    );
  }

  if (mode === 'favnew') {
    return (
      <SwipeBack key="food-favnew" onBack={cancelFavNew} c={c} behind={renderPick()}>
        {renderFavNew()}
      </SwipeBack>
    );
  }

  function renderPick() {
    const forFav = addingTo === 'favorite';
    const showZutaten = forFav || pickTab === 'zutaten';
    // Kopfbereich (Zurueck, Titel, Umschalter, Suche ...) ist Teil des scrollbaren
    // Listenkopfs -> beim Runterscrollen verschwindet er und die Liste nimmt die
    // ganze Seite ein (eine durchgehende Scroll-Seite).
    const header = (
      <View>
        <BackButton onPress={pickBack} c={c} />
        <Text style={styles.title}>{forFav ? t('food.addIngredient') : t('food.add')}</Text>
        {!forFav && (
          <View style={{ marginBottom: 12 }}>
            <Segmented
              options={[{ key: 'zutaten', label: t('food.tabIngredients') }, { key: 'favoriten', label: t('food.tabFavorites') }]}
              value={pickTab}
              onChange={(k) => setPickTab(k as 'zutaten' | 'favoriten')}
              c={c}
            />
          </View>
        )}
        {showZutaten ? (
          <>
            <View style={styles.allergyNote}><Ionicons name="warning" size={15} color="#F0B429" style={{ marginTop: 1 }} /><Text style={styles.allergyText}>{legalShort.allergyHint}</Text></View>
            <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder={t('food.searchPlaceholder')} placeholderTextColor={c.textMuted} autoCorrect={false} />
            <TouchableOpacity style={styles.newFoodBtn} onPress={openNewFood} activeOpacity={0.85}>
              <GlassFill radius={16} />
              <Text style={styles.newFoodText}>{t('food.createOwnFood')}</Text>
            </TouchableOpacity>
            <Text style={styles.countHint}>{searching ? t('food.searching') : `${searchResults.length === 1 ? t('food.searchCountOne', { n: searchResults.length }) : t('food.searchCountMany', { n: searchResults.length })}${searchResults.length >= 2000 ? '+' : ''}`}</Text>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>{t('food.favHint', { meal: mealLabel(mealType) })}</Text>
            <TouchableOpacity style={styles.newFoodBtn} onPress={startNewFavorite} activeOpacity={0.85}>
              <GlassFill radius={16} />
              <Text style={styles.newFoodText}>{t('food.createNewFavorite')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );

    // Datenbank-Treffer (Open Food Facts) als Fuss unter der lokalen Liste – ab 2 Zeichen.
    // Premium: echte Treffer; Gratis: ein Hinweis, der die Funktion erklaert + zur Paywall fuehrt.
    const dbFooter = () => {
      const q = search.trim();
      if (q.length < 2) return null;
      // Gratis-Nutzer: Kontingent verbraucht -> Upsell. Solange Rest frei ist, faellt es durch
      // auf den echten Treffer-Block unten (mit Rest-Hinweis im dbHeadRow).
      const offRemaining = Math.max(0, FREE_FOOD_SEARCHES_PER_DAY - offUsed);
      const qCounted = countedQueriesRef.current.has(q.toLowerCase());
      if (!isPremium && offRemaining <= 0 && !qCounted) {
        return (
          <TouchableOpacity style={styles.dbUpsell} onPress={() => openPaywall('search')} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('food.dbQuotaCta')}>
            <GlassFill radius={16} />
            <Ionicons name="lock-closed" size={16} color={c.primary} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.dbUpsellTitle} numberOfLines={1}>{t('food.dbQuotaCta')}</Text>
              <Text style={styles.dbUpsellHint} numberOfLines={2}>{t('food.dbQuotaHint', { n: FREE_FOOD_SEARCHES_PER_DAY })}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
          </TouchableOpacity>
        );
      }
      // Treffer, die schon lokal vorhanden sind (gleicher Name), nicht doppelt zeigen.
      const localNames = new Set(searchResults.map((f) => f.name.trim().toLowerCase()));
      const dbItems = offResults.filter((o) => !localNames.has(o.name.trim().toLowerCase()));
      return (
        <View style={styles.dbWrap}>
          <View style={styles.dbHeadRow}>
            <Text style={styles.sectionHead}>{t('food.dbSectionTitle')}</Text>
            <Text style={styles.dbSource}>{isPremium ? 'Open Food Facts' : t('food.dbFreeLeft', { n: Math.max(0, FREE_FOOD_SEARCHES_PER_DAY - offUsed) })}</Text>
          </View>
          {offSearching && dbItems.length === 0 ? (
            <View style={styles.dbLoading}>
              <ActivityIndicator color={c.primary} size="small" />
              <Text style={styles.countHint}>  {t('food.dbSearching')}</Text>
            </View>
          ) : dbItems.length === 0 ? (
            <Text style={styles.noResult}>{t('food.dbNoResult')}</Text>
          ) : (
            dbItems.map((o) => (
              <TouchableOpacity key={o.code} style={styles.foodRow} onPress={() => handlePickOff(o)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={o.name}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.foodName} numberOfLines={1}>{o.name}</Text>
                  <Text style={styles.foodMeta} numberOfLines={1}>{o.brand || t('food.dbSectionTitle')}</Text>
                </View>
                <Text style={styles.foodKcal}>{o.kcal} kcal</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      );
    };

    // Die Liste IST die Seite: Kopf scrollt mit weg, Eintraege nutzen die volle Hoehe.
    if (showZutaten) {
      return (
        <FlatList
          style={[styles.container, embedded && styles.embedded]}
          contentContainerStyle={{ paddingBottom: embedded ? TAB_BAR_SPACE : 24 }}
          data={searchResults}
          keyExtractor={(f) => f.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={header}
          initialNumToRender={15}
          maxToRenderPerBatch={20}
          windowSize={10}
          renderItem={({ item: f }) => {
            const own = !!userId && f.user_id === userId;
            return (
              <TouchableOpacity style={styles.foodRow} onPress={() => openAmount(f)} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.foodName}>{f.name}</Text>
                  <Text style={styles.foodMeta}>{f.category}{own ? t('food.ownSuffix') : ''}</Text>
                </View>
                <Text style={styles.foodKcal}>{f.kcal} kcal</Text>
                {own && (
                  <TouchableOpacity onPress={() => confirmDeleteFood(f)} style={styles.foodDel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('food.a11yDeleteFood', { name: f.name })}>
                    <Ionicons name="trash-outline" size={16} color={c.textMuted} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={dbFooter()}
          ListEmptyComponent={searching || search.trim().length >= 2 ? null : <Text style={styles.noResult}>{search.trim() ? t('food.noResultFor', { q: search.trim() }) : t('food.noResult')}</Text>}
        />
      );
    }
    return (
      <FlatList
        style={[styles.container, embedded && styles.embedded]}
        contentContainerStyle={{ paddingBottom: embedded ? TAB_BAR_SPACE : 24 }}
        data={favorites}
        keyExtractor={(f) => f.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        renderItem={({ item: fav }) => (
          <TouchableOpacity style={styles.foodRow} onPress={() => applyFavorite(fav)} activeOpacity={0.7}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="star" size={14} color="#F0B429" />
                <Text style={styles.foodName} numberOfLines={1}>{fav.name}</Text>
              </View>
              <Text style={styles.foodMeta}>{fav.items.length === 1 ? t('food.itemCountOne', { n: fav.items.length }) : t('food.itemCountMany', { n: fav.items.length })}  ·  {favKcal(fav)} kcal</Text>
            </View>
            <TouchableOpacity onPress={() => confirmDeleteFavorite(fav)} style={styles.foodDel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('food.a11yDeleteFavorite', { name: fav.name })}>
              <Ionicons name="trash-outline" size={16} color={c.textMuted} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.noResult}>{t('food.noFavorites')}</Text>}
      />
    );
  }

  function renderFavNew() {
    const draft = favDraft ?? { name: '', items: [] };
    const totalKcal = draft.items.reduce((s, it) => s + Math.round((it.kcal * it.amount_g) / 100), 0);
    return (
        <ScrollView style={[styles.container, embedded && styles.embedded]} contentContainerStyle={{ paddingBottom: embedded ? TAB_BAR_SPACE : 24 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <BackButton onPress={cancelFavNew} c={c} />
          <Text style={styles.title}>{t('food.createFavoriteTitle')}</Text>
          <Text style={styles.subtitle}>{t('food.createFavoriteSubtitle')}</Text>
          <Text style={styles.inputLabel}>{t('food.name')}</Text>
          <TextInput style={styles.input} value={draft.name} onChangeText={(v) => setFavDraft({ name: v, items: draft.items })} placeholder={t('food.favNamePlaceholder')} placeholderTextColor={c.textMuted} />
          <Text style={styles.inputLabel}>{t('food.ingredientsLabel', { n: draft.items.length })}</Text>
          {draft.items.length === 0 ? (
            <Text style={styles.mealEmpty}>{t('food.noIngredientYet')}</Text>
          ) : (
            draft.items.map((it, idx) => (
              <View key={idx} style={[styles.entryRow, idx > 0 && styles.entryDivider]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryName} numberOfLines={1}>{it.name}</Text>
                  <Text style={styles.entryMeta}>{it.amount_g} {it.unit ?? 'g'}  ·  {Math.round((it.kcal * it.amount_g) / 100)} kcal</Text>
                </View>
                <TouchableOpacity onPress={() => removeDraftItem(idx)} style={styles.del} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('food.a11yRemoveItem', { name: it.name })}>
                  <Ionicons name="close" size={15} color={c.textMuted} />
                </TouchableOpacity>
              </View>
            ))
          )}
          <TouchableOpacity style={styles.newFoodBtn} onPress={addItemToFavorite} activeOpacity={0.85}>
            <GlassFill radius={16} />
            <Text style={styles.newFoodText}>{t('food.addIngredientBtn')}</Text>
          </TouchableOpacity>
          {draft.items.length > 0 && <Text style={styles.preview}>{t('food.total', { n: totalKcal })}</Text>}
          <TouchableOpacity style={[styles.primaryBtn, savingFav && { opacity: 0.6 }]} onPress={saveFavorite} disabled={savingFav}>
            {savingFav ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.primaryText}>{t('food.saveFavorite')}</Text>}
          </TouchableOpacity>
          {favErr && <Text style={styles.error}>{favErr}</Text>}
        </ScrollView>
    );
  }

  return renderDiary();

  function renderDiary() {
  const curMeal = mealByHour();
  const usual = usualByMeal[curMeal];
  const curLoggedToday = logs.some((e) => normalizeMeal(e.meal_type) === curMeal);
  const showUsual = !!usual && usual.items.length > 0 && !curLoggedToday;
  return (
    <>
    <ScrollView
      style={[styles.container, embedded && styles.embedded, embedded && styles.bleed]}
      contentContainerStyle={[{ paddingBottom: embedded ? TAB_BAR_SPACE : 24 }, embedded && styles.bleedPad]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
    >
      {!embedded && <Text style={styles.title}>{t('food.title')}</Text>}
      {!embedded && <Text style={styles.subtitle}>{t('food.diarySubtitle')}</Text>}

      {/* HEUTE-Übersicht: gegessen | übrig | Ziel + Balken + Schritte-Pille + Makros */}
      <View style={styles.todayCard}>
        <GlassFill radius={22} />
        <View style={styles.todayRow}>
          <View style={styles.todayCol}><Text style={styles.todayVal} numberOfLines={1}>{totalKcal}</Text><Text style={styles.todayLbl} numberOfLines={1}>{t('food.eaten')}</Text></View>
          <View style={styles.todaySep} />
          <View style={styles.todayCol}><Text style={[styles.todayVal, { color: remaining != null && remaining < 0 ? c.danger : c.primary }]} numberOfLines={1}>{remaining != null ? remaining : '–'}</Text><Text style={styles.todayLbl} numberOfLines={1}>{t('food.remaining')}</Text></View>
          <View style={styles.todaySep} />
          <View style={styles.todayCol}><Text style={styles.todayVal} numberOfLines={1}>{effTarget ?? '–'}</Text><Text style={styles.todayLbl} numberOfLines={1}>{t('food.goal')}</Text></View>
        </View>
        {effTarget != null && (
          <View style={styles.kcalTrack}>
            <View style={[styles.kcalFill, { width: `${Math.min(100, Math.round((totalKcal / effTarget) * 100))}%`, backgroundColor: totalKcal > effTarget ? c.danger : c.primary }]} />
          </View>
        )}
        {(trainingKcal > 0 || activityKcal > 0 || cardioKcal > 0) && (
          <View style={styles.bonusPill}>
            <Ionicons name={activityKcal > 0 ? 'walk' : 'flame'} size={14} color={c.primary} />
            <Text style={styles.bonusText} numberOfLines={1}>{t('food.kcalExtra', { n: trainingKcal + activityKcal + cardioKcal })}{activityKcal > 0 && steps > 0 ? t('food.stepsSuffix', { steps: steps.toLocaleString(lang === 'en' ? 'en-US' : 'de-DE') }) : ''}</Text>
          </View>
        )}
        <View style={styles.macrosRow}>
          <View style={styles.macroCol2}>
            <Text style={styles.macroLbl} numberOfLines={1}>{t('food.mProtein')}</Text>
            <Text style={styles.macroVal} numberOfLines={1}>{totalP} <Text style={styles.macroUnit}>g</Text></Text>
            <View style={styles.macroTrack}><View style={[styles.macroFill, { width: `${macroPct(totalP, macroTargets?.p)}%`, backgroundColor: c.primary }]} /></View>
          </View>
          <View style={styles.macroCol2}>
            <Text style={styles.macroLbl} numberOfLines={1}>{t('food.mCarbs')}</Text>
            <Text style={styles.macroVal} numberOfLines={1}>{totalC} <Text style={styles.macroUnit}>g</Text></Text>
            <View style={styles.macroTrack}><View style={[styles.macroFill, { width: `${macroPct(totalC, macroTargets?.c)}%`, backgroundColor: '#E69500' }]} /></View>
          </View>
          <View style={styles.macroCol2}>
            <Text style={styles.macroLbl} numberOfLines={1}>{t('food.mFat')}</Text>
            <Text style={styles.macroVal} numberOfLines={1}>{totalF} <Text style={styles.macroUnit}>g</Text></Text>
            <View style={styles.macroTrack}><View style={[styles.macroFill, { width: `${macroPct(totalF, macroTargets?.f)}%`, backgroundColor: c.danger }]} /></View>
          </View>
        </View>
      </View>

      {/* Mahlzeit hinzufuegen (aufgeraeumt): KI-Eingabe + drei kompakte Aktionen */}
      <View style={styles.nlCard}>
        <GlassFill radius={22} />
        <View style={styles.nlInputRow}>
          <TextInput
            style={styles.nlInputFlex}
            value={nlText}
            onChangeText={setNlText}
            placeholder={t('food.nlPlaceholder')}
            placeholderTextColor={c.textMuted}
            multiline
            editable={!nlBusy}
          />
          <TouchableOpacity
            style={[styles.nlSend, isPremium && (nlBusy || !nlText.trim()) && { opacity: 0.5 }]}
            onPress={recognizeMeal}
            disabled={isPremium && (nlBusy || !nlText.trim())}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isPremium ? t('food.nlRecognize') : t('food.nlRecognizePremium')}
          >
            {nlBusy && !nlItems ? <ActivityIndicator color={c.onPrimary} size="small" /> : <Ionicons name={isPremium ? 'arrow-up' : 'lock-closed'} size={19} color={c.onPrimary} />}
          </TouchableOpacity>
        </View>
        <Text style={styles.nlConsentHint}>{t('food.nlConsentHint')}</Text>
        {nlErr && <Text style={styles.error}>{nlErr}</Text>}
        <View style={styles.chipRow}>
          <TouchableOpacity style={styles.actChip} onPress={() => openPick(mealByHour())} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('food.searchChip')}>
            <Ionicons name="search" size={19} color={c.primary} />
            <Text style={styles.actChipText} numberOfLines={1}>{t('food.searchChip')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actChip} onPress={() => { setError(null); setScannerOpen(true); }} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('food.scan')}>
            <Ionicons name="barcode-outline" size={19} color={c.primary} />
            <Text style={styles.actChipText} numberOfLines={1}>{t('food.scan')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actChip} onPress={recognizeMealPhoto} disabled={nlBusy} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('food.photoChip')}>
            <Ionicons name={isPremium ? 'camera-outline' : 'lock-closed'} size={19} color={c.primary} />
            <Text style={styles.actChipText} numberOfLines={1}>{t('food.photoChip')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.infoLine}>
        <Ionicons name="information-circle-outline" size={14} color={c.textMuted} style={{ marginTop: 1 }} />
        <Text style={styles.infoLineText}>{t('food.trackerHint')}</Text>
      </View>

      {/* "Mein üblicher Tag": die übliche Mahlzeit mit 1 Tipp hinzufügen */}
      {showUsual && usual && (
        <View style={styles.usualCard}>
          <GlassFill radius={14} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="star" size={13} color="#F0B429" />
              <Text style={styles.usualTitle} numberOfLines={1}>{t('food.usualTitle', { meal: mealLabel(curMeal) })}</Text>
            </View>
            <Text style={styles.usualItems} numberOfLines={2}>{usual.items.map((i) => i.food.name).join(' · ')}  ·  {usual.kcal} kcal</Text>
          </View>
          <TouchableOpacity style={styles.usualBtn} onPress={() => addUsual(curMeal)} disabled={busyRef.current} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('food.a11yAddUsual', { meal: mealLabel(curMeal) })}>
            <Text style={styles.usualBtnText}>{t('food.oneTap')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Schnellzugriff */}
      {quickFoods.length > 0 && (
        <View style={styles.quickWrap}>
          <Text style={styles.sectionHead}>{t('food.quickAccess')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }} keyboardShouldPersistTaps="handled">
            {quickFoods.map((qf) => (
              <TouchableOpacity key={qf.food.id} style={styles.quickChip} onPress={() => quickAdd(qf)} activeOpacity={0.8}>
                <GlassFill radius={12} />
                <Text style={styles.quickName} numberOfLines={1}>{qf.food.name}</Text>
                <Text style={styles.quickMeta}>+{qf.amount} {foodUnit(qf.food)} · {Math.round((qf.food.kcal * qf.amount) / 100)} kcal</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {quickMsg && <Text style={styles.quickMsg}>{quickMsg}</Text>}
        </View>
      )}

      {/* Tagebuch (nach Mahlzeiten gruppiert) */}
      <Text style={styles.sectionHead}>{t('food.diary')}</Text>
      {TRACKER_MEALS.map((m) => {
        const items = logs.filter((e) => normalizeMeal(e.meal_type) === m.key);
        const mealKcal = items.reduce((s, e) => s + kcalOf(e), 0);
        return (
          <View key={m.key} style={styles.mealCard}>
            <GlassFill radius={14} />
            <View style={styles.mealHeader}>
              <View style={[styles.mealChipIcon, { backgroundColor: MEAL_ION[m.key].bg }]}>
                <Ionicons name={MEAL_ION[m.key].icon as any} size={17} color={MEAL_ION[m.key].fg} />
              </View>
              <Text style={styles.mealTitle} numberOfLines={1}>{mealLabel(m.key)}</Text>
              <View style={styles.mealHeaderRight}>
                {mealKcal > 0 && <Text style={styles.mealKcal} numberOfLines={1}>{mealKcal} kcal</Text>}
                {items.length > 0 && (
                  <TouchableOpacity style={styles.mealRound} onPress={() => saveMealAsFavorite(m.key, items)} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('food.a11ySaveMealAsFavorite', { meal: mealLabel(m.key) })}>
                    <Ionicons name="star" size={15} color="#F0B429" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.mealRoundPlus} onPress={() => openPick(m.key)} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('food.a11yAddToMeal', { meal: mealLabel(m.key) })}>
                  <Ionicons name="add" size={17} color={c.primary} />
                </TouchableOpacity>
              </View>
            </View>
            {items.length === 0 ? (
              <Text style={styles.mealEmpty}>{t('food.mealEmpty')}</Text>
            ) : (
              items.map((e, idx) => (
                <View key={e.id} style={[styles.entryRow, idx > 0 && styles.entryDivider]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryName} numberOfLines={1}>{e.food?.name ?? '—'}</Text>
                    <Text style={styles.entryMeta}>{e.amount_g} {foodUnit(e.food)}</Text>
                  </View>
                  <Text style={styles.entryKcal}>{kcalOf(e)} kcal</Text>
                  <TouchableOpacity onPress={() => deleteLog(e.id)} style={styles.del} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('food.a11yRemoveEntry', { name: e.food?.name ?? t('food.entry') })}><Ionicons name="close" size={15} color={c.textMuted} /></TouchableOpacity>
                </View>
              ))
            )}
          </View>
        );
      })}
      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
    <BarcodeScanner visible={scannerOpen} c={c} onClose={() => setScannerOpen(false)} onScanned={handleScanned} />
    <Modal visible={!!nlItems} transparent animationType="slide" onRequestClose={() => setNlItems(null)}>
      <View style={[styles.nlOverlay, { paddingBottom: kb }]}>
        <View style={styles.nlSheet}>
          <Text style={styles.nlSheetTitle}>{t('food.nlSheetTitle')}</Text>
          <Text style={styles.nlMealLabel}>{t('food.nlWhichMeal')}</Text>
          <View style={styles.nlMealRow}>
            {TRACKER_MEALS.map((m) => {
              const active = nlMeal === m.key;
              return (
                <TouchableOpacity key={m.key} onPress={() => setNlMealAll(m.key)} style={[styles.nlChip, active && styles.nlChipActive]} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ selected: active }}>
                  <GlassFill radius={999} />
                  <Text style={[styles.nlChipText, active && styles.nlChipTextActive]}>{mealLabel(m.key)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
            {(nlItems ?? []).map((it, idx) => {
              const u = foodUnit({ name: it.name });
              return (
              <View key={idx} style={[styles.entryRow, idx > 0 && styles.entryDivider]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryName} numberOfLines={1}>{it.name}</Text>
                  <View style={styles.nlAmtRow}>
                    <TextInput
                      style={[styles.nlAmtInput, it.amount_g < 1 && { borderColor: c.danger }]}
                      value={it.amount_g ? String(it.amount_g) : ''}
                      onChangeText={(txt) => setNlAmount(idx, txt)}
                      keyboardType="number-pad"
                      selectTextOnFocus
                      maxLength={6}
                      placeholder="0"
                      placeholderTextColor={c.textMuted}
                      accessibilityLabel={t('food.a11yAmountFor', { name: it.name, unit: u })}
                    />
                    <Text style={styles.nlAmtUnit}>{u}</Text>
                    <Text style={styles.entryMeta} numberOfLines={1}>  ·  {Math.round((it.kcal * it.amount_g) / 100)} kcal</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setNlItems((cur) => (cur ?? []).filter((_, i) => i !== idx))} style={styles.del} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('food.a11yRemoveItem', { name: it.name })}>
                  <Ionicons name="close" size={15} color={c.textMuted} />
                </TouchableOpacity>
              </View>
              );
            })}
            {nlItems?.length === 0 && <Text style={styles.mealEmpty}>{t('food.nlNothingLeft')}</Text>}
            {!!nlItems?.some((it) => it.amount_g < 1) && <Text style={styles.nlHint}>{t('food.nlEnterAmounts')}</Text>}
          </ScrollView>
          <TouchableOpacity style={[styles.primaryBtn, (nlBusy || !nlItems?.length || !!nlItems?.some((it) => it.amount_g < 1)) && { opacity: 0.5 }]} onPress={applyNlItems} disabled={nlBusy || !nlItems?.length || !!nlItems?.some((it) => it.amount_g < 1)} activeOpacity={0.85}>
            {nlBusy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.primaryText}>{t('food.nlAddToDiary')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setNlItems(null)} style={{ marginTop: 12 }}>
            <Text style={styles.nlClose}>{t('food.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    <Modal visible={aiConsentAsk} transparent animationType="fade" onRequestClose={() => setAiConsentAsk(false)}>
      <View style={styles.nlOverlay}>
        <View style={styles.nlSheet}>
          <Text style={styles.nlSheetTitle}>{t('food.consentTitle')}</Text>
          <Text style={styles.consentBody}>{t('food.consentBody')}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={acceptAiConsent} activeOpacity={0.85}>
            <Text style={styles.primaryText}>{t('food.consentAccept')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAiConsentAsk(false)} style={{ marginTop: 12 }}>
            <Text style={styles.nlClose}>{t('food.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  );
  }
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 56, paddingHorizontal: 16 },
    embedded: { paddingTop: 4, paddingHorizontal: 0, backgroundColor: 'transparent' },
    // Eingebettet im Essen-Hub (der 20px Seitenrand hat): die Liste bis zum echten
    // Bildschirmrand ziehen, damit der Scroll-Balken rechts ganz am Rand sitzt statt
    // eingerueckt. Der Inhalt bleibt per bleedPad genau an Ort und Stelle.
    bleed: { marginHorizontal: -20 },
    bleedPad: { paddingHorizontal: 20 },
    title: { fontSize: 26, fontWeight: '800', color: c.heading },
    subtitle: { fontSize: 15, color: c.textMuted, marginTop: 2, marginBottom: 16 },
    disclaimer: { fontSize: 12, color: c.textMuted, lineHeight: 16, marginTop: 2, marginBottom: 10 },
    allergyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: 'rgba(240,180,41,0.08)', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: 'rgba(240,180,41,0.20)', marginBottom: 10 },
    allergyText: { flex: 1, fontSize: 12, color: c.text, lineHeight: 16, fontWeight: '500' },
    back: { color: c.primary, fontSize: 15, fontWeight: '600', marginBottom: 10 },
    addText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
    actionRow: { flexDirection: 'row', gap: 11, marginBottom: 12 },
    addBtnRow: { flex: 1, flexDirection: 'row', gap: 7, backgroundColor: c.primary, borderRadius: 15, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
    scanBtn: { flex: 1, flexDirection: 'row', gap: 7, backgroundColor: c.card, borderWidth: 1, borderColor: 'rgba(25,201,143,0.45)', borderRadius: 15, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    scanText: { color: c.primary, fontSize: 15, fontWeight: '700' },
    quickWrap: { marginBottom: 12 },
    quickChip: { ...shadow, backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, maxWidth: 200 },
    quickName: { fontSize: 13, fontWeight: '700', color: c.heading },
    quickMeta: { fontSize: 11, color: c.textMuted, marginTop: 4 },
    quickMsg: { fontSize: 13, color: c.success, marginTop: 10, fontWeight: '600' },
    sectionHead: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: c.textMuted, marginBottom: 8, marginLeft: 4 },

    todayCard: { ...shadow, backgroundColor: c.card, borderRadius: 22, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    todayRow: { flexDirection: 'row', alignItems: 'center' },
    todayCol: { flex: 1, alignItems: 'center' },
    todayVal: { fontSize: 20, fontWeight: '800', color: c.heading, letterSpacing: -0.3 },
    todayLbl: { fontSize: 11, color: c.textMuted, fontWeight: '500', marginTop: 8 },
    todaySep: { width: 1, height: 36, backgroundColor: c.border },
    kcalTrack: { height: 6, backgroundColor: c.track, borderRadius: 4, overflow: 'hidden', marginTop: 14 },
    kcalFill: { height: 6, borderRadius: 4 },
    bonusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 13, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(22,180,134,0.25)', backgroundColor: 'rgba(22,180,134,0.10)' },
    bonusText: { fontSize: 12, fontWeight: '600', color: c.primary },
    macrosRow: { flexDirection: 'row', gap: 12, marginTop: 15, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingTop: 15 },
    macroCol2: { flex: 1, minWidth: 0 },
    macroLbl: { fontSize: 11, fontWeight: '600', color: c.textMuted, marginBottom: 8 },
    macroVal: { fontSize: 15, fontWeight: '800', color: c.heading },
    macroUnit: { fontSize: 11, fontWeight: '500', color: c.textMuted },
    macroTrack: { height: 5, borderRadius: 3, backgroundColor: c.track, overflow: 'hidden', marginTop: 9 },
    macroFill: { height: 5, borderRadius: 3 },

    mealCard: { ...shadow, backgroundColor: c.card, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 13, marginBottom: 10, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    entryDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    entryName: { fontSize: 15, color: c.text, fontWeight: '600' },
    entryMeta: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    entryKcal: { fontSize: 13, color: c.primary, fontWeight: '700', marginRight: 10 },
    del: { padding: 4 },
    delText: { fontSize: 16, color: c.textMuted },
    mealChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    mealChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border },
    mealChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    mealChipText: { fontSize: 14, fontWeight: '600', color: c.text },
    mealChipTextActive: { color: c.onPrimary },
    mealHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 6 },
    mealTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: c.heading },
    mealHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    mealKcal: { fontSize: 12, fontWeight: '700', color: c.textMuted },
    mealChipIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    mealRound: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    mealRoundPlus: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(25,201,143,0.14)', alignItems: 'center', justifyContent: 'center' },
    mealEmpty: { fontSize: 12, color: c.textMuted, fontStyle: 'italic', paddingVertical: 3, paddingLeft: 2 },
    usualCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 13, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(25,201,143,0.30)', overflow: 'hidden' },
    usualTitle: { fontSize: 14, fontWeight: '800', color: c.heading },
    usualItems: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    usualBtn: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginLeft: 10 },
    usualBtnText: { color: c.onPrimary, fontWeight: '800', fontSize: 14 },
    nlCard: { backgroundColor: c.card, borderRadius: 22, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(25,201,143,0.25)', overflow: 'hidden' },
    nlHead: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 10 },
    nlChipIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(25,201,143,0.12)', alignItems: 'center', justifyContent: 'center' },
    nlTitle: { fontSize: 14, fontWeight: '800', color: c.heading },
    nlConsentHint: { fontSize: 11, color: c.textMuted, lineHeight: 15, marginTop: 3 },
    consentBody: { fontSize: 14, color: c.text, lineHeight: 20, marginBottom: 18 },
    nlInput: { borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: c.inputBg, color: c.text, minHeight: 44 },
    nlBtn: { backgroundColor: c.primary, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 11 },
    nlBtnText: { color: c.onPrimary, fontSize: 15, fontWeight: '800' },
    nlPhotoBtn: { borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 9, borderWidth: 1, borderColor: c.primary, backgroundColor: 'transparent' },
    nlPhotoBtnText: { color: c.primary, fontSize: 15, fontWeight: '700' },
    btnRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    // Aufgeraeumter "Mahlzeit hinzufuegen"-Block
    nlInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
    nlInputFlex: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: c.inputBg, color: c.text, minHeight: 44, maxHeight: 120 },
    nlSend: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    chipRow: { flexDirection: 'row', gap: 9, marginTop: 12 },
    actChip: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingVertical: 12 },
    actChipText: { fontSize: 12, fontWeight: '600', color: c.text },
    infoLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 10, marginBottom: 14, paddingHorizontal: 2 },
    infoLineText: { flex: 1, fontSize: 11, color: c.textMuted, lineHeight: 15 },
    nlOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    nlSheet: { backgroundColor: c.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, paddingBottom: 32 },
    nlSheetTitle: { fontSize: 18, fontWeight: '800', color: c.heading, marginBottom: 10 },
    nlClose: { textAlign: 'center', color: c.textMuted, fontSize: 14 },
    nlAmtRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
    nlAmtInput: { minWidth: 52, paddingVertical: 3, paddingHorizontal: 8, borderWidth: 1, borderColor: c.border, borderRadius: 8, backgroundColor: c.inputBg, color: c.text, fontSize: 13, fontWeight: '700', textAlign: 'right' },
    nlAmtUnit: { color: c.textMuted, fontSize: 13, marginLeft: 4 },
    nlHint: { color: c.danger, fontSize: 12, marginTop: 8 },
    nlMealLabel: { color: c.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
    nlMealRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
    nlChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, marginRight: 8, marginBottom: 8 },
    nlChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    nlChipText: { color: c.text, fontSize: 13, fontWeight: '700' },
    nlChipTextActive: { color: c.onPrimary },
    inputLabel: { fontSize: 14, color: c.text, fontWeight: '600', marginTop: 8, marginBottom: 6 },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, backgroundColor: c.inputBg, color: c.text },
    preview: { fontSize: 18, fontWeight: '700', color: c.heading, marginTop: 14 },
    primaryBtn: { backgroundColor: c.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
    primaryText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
    countHint: { fontSize: 12, color: c.textMuted, marginTop: 8, marginBottom: 4 },
    unitHint: { fontSize: 12, color: c.textMuted, marginTop: 6, lineHeight: 16 },
    foodRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 18, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden' },
    foodName: { fontSize: 16, color: c.text, fontWeight: '600' },
    foodMeta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    foodKcal: { fontSize: 14, color: c.primary, fontWeight: '700', marginLeft: 8 },
    foodDel: { paddingHorizontal: 6, paddingVertical: 4, marginLeft: 6 },
    foodDelText: { fontSize: 16 },
    newFoodBtn: { flexDirection: 'row', gap: 7, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(25,201,143,0.45)', borderRadius: 16, paddingVertical: 13, alignItems: 'center', marginTop: 10, backgroundColor: c.card, overflow: 'hidden' },
    newFoodText: { color: c.primary, fontSize: 15, fontWeight: '700' },
    noResult: { fontSize: 14, color: c.textMuted, textAlign: 'center', marginTop: 18, lineHeight: 20 },
    macroRow: { flexDirection: 'row', gap: 10 },
    macroCol: { flex: 1 },
    error: { color: c.danger, fontSize: 14, marginTop: 14, textAlign: 'center' },
    // Datenbank-Suche (Open Food Facts)
    dbWrap: { marginTop: 16 },
    dbHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dbSource: { fontSize: 10, fontWeight: '700', color: c.textMuted, letterSpacing: 0.3, marginBottom: 8, marginRight: 4, opacity: 0.7 },
    dbLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
    dbUpsell: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: c.card, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13, marginTop: 16, borderWidth: 1, borderColor: 'rgba(25,201,143,0.45)', overflow: 'hidden' },
    dbUpsellTitle: { fontSize: 14, fontWeight: '700', color: c.heading },
    dbUpsellHint: { fontSize: 12, color: c.textMuted, marginTop: 2, lineHeight: 16 },
  });
}
