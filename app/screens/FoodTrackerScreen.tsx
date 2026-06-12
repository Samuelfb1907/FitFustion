// Kalorien-Tracker / Tagebuch (themed): eigene Zutaten auswählen, Menge angeben, Tag tracken.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT, useLang } from '../contexts/LanguageContext';
import { computeNutrition, ageFromBirthDate, Gender, ActivityLevel, GoalType } from '../lib/nutrition';
import BarcodeScanner from '../components/BarcodeScanner';
import { resolveBarcodeFood } from '../lib/barcodeFood';
import { TRACKER_MEALS, MealType, mealByHour, normalizeMeal } from '../lib/meals';
import { getLegalShort } from '../lib/legal';
import { useFocusTick } from '../lib/useFocusTick';
import ErrorRetry from '../components/ErrorRetry';
import { errorMessage } from '../lib/errors';
import { todayStr, daysAgoStr } from '../lib/date';
import { todayTrainingKcal } from '../lib/trainingBonus';
import { hasStepsPermission, getTodayActivity } from '../lib/health';
import BackButton from '../components/BackButton';
import SwipeBack from '../components/SwipeBack';
import Segmented from '../components/Segmented';
import GlassFill from '../components/GlassFill';
import { usePaywall } from '../components/Paywall';
import { parseMeal, ParsedItem } from '../lib/parseMeal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CARD_SHADOW as shadow } from '../lib/ui';

type Food = { id: string; name: string; category: string | null; kcal: number; protein: number; carbs: number; fat: number; user_id?: string | null };
type LogEntry = { id: string; amount_g: number; meal_type: string | null; food: Food | null };
type QuickFood = { food: Food; amount: number; count: number };
// Favorit = gespeicherte Mahlzeit (z. B. dein taegliches Fruehstueck) mit mehreren Zutaten.
type FavItem = { food_id: string; name: string; amount_g: number; kcal: number; protein: number; carbs: number; fat: number };
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

// todayStr -> lib/date.ts

export default function FoodTrackerScreen({ embedded, focusTick }: { embedded?: boolean; focusTick?: number }) {
  const { session, isPremium } = useAuth();
  const userId = session?.user?.id;
  const { openPaywall } = usePaywall();
  const c = useColors();
  const t = useT();
  const { lang } = useLang();
  const legalShort = getLegalShort(lang);
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [targetKcal, setTargetKcal] = useState<number | null>(null);
  const [trainingKcal, setTrainingKcal] = useState(0);
  const [steps, setSteps] = useState(0);
  const [activityKcal, setActivityKcal] = useState(0);
  const [activityMeasured, setActivityMeasured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'diary' | 'pick' | 'amount' | 'newfood' | 'favnew'>('diary');
  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [amount, setAmount] = useState('100');
  const [mealType, setMealType] = useState<MealType>(mealByHour());
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [quickFoods, setQuickFoods] = useState<QuickFood[]>([]);
  const [quickMsg, setQuickMsg] = useState<string | null>(null);
  // Formular "Eigenes Lebensmittel anlegen"
  const [nf, setNf] = useState({ name: '', cat: '', kcal: '', protein: '', carbs: '', fat: '' });
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
  const [favMsg, setFavMsg] = useState<string | null>(null);
  const [usualByMeal, setUsualByMeal] = useState<Partial<Record<MealType, UsualMeal>>>({});
  // "Sprich's einfach": Mahlzeit in Sprache eingeben -> KI erkennt
  const [nlText, setNlText] = useState('');
  const [nlBusy, setNlBusy] = useState(false);
  const [nlErr, setNlErr] = useState<string | null>(null);
  const [nlItems, setNlItems] = useState<ParsedItem[] | null>(null);
  const [nlMeal, setNlMeal] = useState<MealType>(mealByHour());
  const [aiConsent, setAiConsent] = useState(false);
  const [aiConsentAsk, setAiConsentAsk] = useState(false);
  useEffect(() => { AsyncStorage.getItem('fitavo.aiConsentAt').then((v) => { if (v) setAiConsent(true); }).catch(() => {}); }, []);
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

  async function handleScanned(code: string) {
    setScannerOpen(false);
    if (!userId) return;
    setScanning(true);
    setError(null);
    const res = await resolveBarcodeFood(userId, code);
    setScanning(false);
    if (!res.food) {
      setError(res.reason === 'not_found'
        ? t('food.barcodeNotFound', { code })
        : t('food.barcodeFetchFailed'));
      return;
    }
    const food = res.food;
    setSelectedFood(food);
    setAmount('100');
    setMealType(mealByHour());
    setBackTarget('diary'); // vom Scan kam man aus dem Tagebuch -> dorthin zurueck
    setMode('amount');
  }

  async function init(silent = false) {
    if (!userId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
    const { data: prof } = await supabase.from('profiles').select('weight_kg, height_cm, birth_date, gender, activity_level').eq('id', userId).maybeSingle();
    const { data: goal } = await supabase.from('goals').select('goal_type').eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (prof && prof.weight_kg && prof.height_cm) {
      const t = computeNutrition({
        weightKg: Number(prof.weight_kg), heightCm: Number(prof.height_cm), age: ageFromBirthDate(prof.birth_date),
        gender: (prof.gender ?? 'prefer_not') as Gender, activity: (prof.activity_level ?? 'moderate') as ActivityLevel, goal: (goal?.goal_type ?? 'general_fitness') as GoalType,
      });
      setTargetKcal(t.targetCalories);
      setTrainingKcal(await todayTrainingKcal(userId, Number(prof.weight_kg)));
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
      setQuickMsg(t('food.usualAdded', { meal: TRACKER_MEALS.find((m) => m.key === meal)?.label ?? '' }));
      setTimeout(() => setQuickMsg(null), 2500);
      await init(true);
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
    runRecognize();
  }
  async function runRecognize() {
    const text = nlText.trim();
    if (!text || nlBusy) return;
    setNlBusy(true); setNlErr(null);
    try {
      const items = await parseMeal(text, mealByHour());
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
            .insert({ name: it.name, category: 'KI-erkannt', kcal: it.kcal, protein: it.protein, carbs: it.carbs, fat: it.fat, user_id: userId })
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
      setQuickMsg(t('food.foodAdded', { name: qf.food.name, amount: qf.amount }));
      setTimeout(() => setQuickMsg(null), 2500);
      await init(true);
    } finally {
      busyRef.current = false;
    }
  }

  async function addLog() {
    if (!userId || !selectedFood || busyRef.current) return;
    const a = Number(amount.replace(',', '.'));
    if (!a || a <= 0) { setError(t('food.invalidAmount')); return; }
    // Beim Erstellen eines Favoriten: Zutat in den Entwurf legen statt ins Tagebuch.
    if (addingTo === 'favorite') {
      const food = selectedFood;
      setFavDraft((d) => {
        const base = d ?? { name: '', items: [] };
        return { name: base.name, items: [...base.items, { food_id: food.id, name: food.name, amount_g: a, kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat }] };
      });
      setSelectedFood(null); setAmount('100'); setError(null); setSearch(''); setMode('favnew');
      return;
    }
    busyRef.current = true;
    setSaving(true); setError(null);
    const addedName = selectedFood.name;
    try {
      const { error: e } = await supabase.from('food_logs').insert({ user_id: userId, food_id: selectedFood.id, amount_g: a, log_date: todayStr(), meal_type: mealType });
      if (e) { setError(errorMessage(e)); return; }
      setSelectedFood(null); setAmount('100'); setSearch(''); setMode('diary');
      setQuickMsg(t('food.foodAdded', { name: addedName, amount: a }));
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
    setNf({ name: search.trim(), cat: '', kcal: '', protein: '', carbs: '', fat: '' });
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
      .insert({ name, category: nf.cat.trim() || 'Eigene', kcal, protein, carbs, fat, user_id: userId })
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
    setSelectedFood(food); setAmount('100'); setError(null); setBackTarget('pick'); setMode('amount');
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
  const effTarget = targetKcal != null ? targetKcal + Math.max(trainingKcal, activityKcal) : null;
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
    const a = Number(amount.replace(',', '.')) || 0;
    const previewKcal = Math.round((selectedFood.kcal * a) / 100);
    return (
      <SwipeBack key="food-amount" onBack={() => setMode(backTarget)} c={c} behind={backTarget === 'pick' ? renderPick() : renderDiary()}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={[styles.container, embedded && styles.embedded]} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <BackButton onPress={() => setMode(backTarget)} c={c} />
          <Text style={styles.title}>{selectedFood.name}</Text>
          <Text style={styles.subtitle}>{t('food.kcalPer100g', { n: selectedFood.kcal })}</Text>
          <Text style={styles.inputLabel}>{t('food.amountInGrams')}</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" inputMode="decimal" placeholder={t('food.amountPlaceholder')} placeholderTextColor={c.textMuted} returnKeyType="done" onSubmitEditing={addLog} />
          <Text style={styles.preview}>= {previewKcal} kcal</Text>
          {addingTo !== 'favorite' && (
            <>
              <Text style={styles.inputLabel}>{t('food.meal')}</Text>
              <View style={styles.mealChips}>
                {TRACKER_MEALS.map((m) => (
                  <TouchableOpacity key={m.key} style={[styles.mealChip, mealType === m.key && styles.mealChipActive]} onPress={() => setMealType(m.key)} activeOpacity={0.8}>
                    <Text style={[styles.mealChipText, mealType === m.key && styles.mealChipTextActive]}>{m.icon} {m.label}</Text>
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
      </KeyboardAvoidingView>
      </SwipeBack>
    );
  }

  if (mode === 'newfood') {
    return (
      <SwipeBack key="food-newfood" onBack={() => setMode('pick')} c={c} behind={renderPick()}>
      <ScrollView style={[styles.container, embedded && styles.embedded]} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <BackButton onPress={() => setMode('pick')} c={c} />
        <Text style={styles.title}>{t('food.newFoodTitle')}</Text>
        <Text style={styles.subtitle}>{t('food.nutritionPer100g')}</Text>
        <Text style={styles.inputLabel}>{t('food.name')}</Text>
        <TextInput style={styles.input} value={nf.name} onChangeText={(v) => setNf({ ...nf, name: v })} placeholder={t('food.namePlaceholder')} placeholderTextColor={c.textMuted} />
        <Text style={styles.inputLabel}>{t('food.categoryOptional')}</Text>
        <TextInput style={styles.input} value={nf.cat} onChangeText={(v) => setNf({ ...nf, cat: v })} placeholder={t('food.categoryPlaceholder')} placeholderTextColor={c.textMuted} />
        <Text style={styles.inputLabel}>{t('food.calories')}</Text>
        <TextInput style={styles.input} value={nf.kcal} onChangeText={(v) => setNf({ ...nf, kcal: v })} keyboardType="numeric" placeholder={t('food.per100g')} placeholderTextColor={c.textMuted} />
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
            <View style={styles.allergyNote}><Text style={styles.allergyText}>{legalShort.allergyHint}</Text></View>
            <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder={t('food.searchPlaceholder')} placeholderTextColor={c.textMuted} autoCorrect={false} />
            <TouchableOpacity style={styles.newFoodBtn} onPress={openNewFood} activeOpacity={0.85}>
              <GlassFill radius={16} />
              <Text style={styles.newFoodText}>{t('food.createOwnFood')}</Text>
            </TouchableOpacity>
            <Text style={styles.countHint}>{searching ? t('food.searching') : `${searchResults.length === 1 ? t('food.searchCountOne', { n: searchResults.length }) : t('food.searchCountMany', { n: searchResults.length })}${searchResults.length >= 2000 ? '+' : ''}`}</Text>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>{t('food.favHint', { meal: TRACKER_MEALS.find((m) => m.key === mealType)?.label ?? t('food.theMeal') })}</Text>
            <TouchableOpacity style={styles.newFoodBtn} onPress={startNewFavorite} activeOpacity={0.85}>
              <GlassFill radius={16} />
              <Text style={styles.newFoodText}>{t('food.createNewFavorite')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );

    // Die Liste IST die Seite: Kopf scrollt mit weg, Eintraege nutzen die volle Hoehe.
    if (showZutaten) {
      return (
        <FlatList
          style={[styles.container, embedded && styles.embedded]}
          contentContainerStyle={{ paddingBottom: 40 }}
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
              <TouchableOpacity style={styles.foodRow} onPress={() => { setSelectedFood(f); setAmount('100'); setError(null); setBackTarget('pick'); setMode('amount'); }} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.foodName}>{f.name}</Text>
                  <Text style={styles.foodMeta}>{f.category}{own ? t('food.ownSuffix') : ''}</Text>
                </View>
                <Text style={styles.foodKcal}>{f.kcal} kcal</Text>
                {own && (
                  <TouchableOpacity onPress={() => confirmDeleteFood(f)} style={styles.foodDel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('food.a11yDeleteFood', { name: f.name })}>
                    <Text style={styles.foodDelText}>🗑</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={searching ? null : <Text style={styles.noResult}>{search.trim() ? t('food.noResultFor', { q: search.trim() }) : t('food.noResult')}</Text>}
        />
      );
    }
    return (
      <FlatList
        style={[styles.container, embedded && styles.embedded]}
        contentContainerStyle={{ paddingBottom: 40 }}
        data={favorites}
        keyExtractor={(f) => f.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        renderItem={({ item: fav }) => (
          <TouchableOpacity style={styles.foodRow} onPress={() => applyFavorite(fav)} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              <Text style={styles.foodName}>⭐  {fav.name}</Text>
              <Text style={styles.foodMeta}>{fav.items.length === 1 ? t('food.itemCountOne', { n: fav.items.length }) : t('food.itemCountMany', { n: fav.items.length })}  ·  {favKcal(fav)} kcal</Text>
            </View>
            <TouchableOpacity onPress={() => confirmDeleteFavorite(fav)} style={styles.foodDel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('food.a11yDeleteFavorite', { name: fav.name })}>
              <Text style={styles.foodDelText}>🗑</Text>
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={[styles.container, embedded && styles.embedded]} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
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
                  <Text style={styles.entryMeta}>{it.amount_g} g  ·  {Math.round((it.kcal * it.amount_g) / 100)} kcal</Text>
                </View>
                <TouchableOpacity onPress={() => removeDraftItem(idx)} style={styles.del} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('food.a11yRemoveItem', { name: it.name })}>
                  <Text style={styles.delText}>✕</Text>
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
      </KeyboardAvoidingView>
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
      contentContainerStyle={[{ paddingBottom: 40 }, embedded && styles.bleedPad]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
    >
      {!embedded && <Text style={styles.title}>{t('food.title')}</Text>}
      {!embedded && <Text style={styles.subtitle}>{t('food.diarySubtitle')}</Text>}

      {/* HEUTE-Übersicht */}
      <View style={styles.todayCard}>
        <GlassFill radius={16} />
        <View style={styles.todayRow}>
          <View style={styles.todayCol}><Text style={styles.todayVal}>{totalKcal}</Text><Text style={styles.todayLbl}>{t('food.eaten')}</Text></View>
          <View style={styles.todaySep} />
          <View style={styles.todayCol}><Text style={styles.todayVal}>{effTarget ?? '–'}</Text><Text style={styles.todayLbl}>{t('food.goal')}</Text></View>
          <View style={styles.todaySep} />
          <View style={styles.todayCol}><Text style={[styles.todayVal, remaining != null && remaining < 0 && { color: c.danger }]}>{remaining != null ? remaining : '–'}</Text><Text style={styles.todayLbl}>{t('food.remaining')}</Text></View>
        </View>
        {effTarget != null && (
          <View style={styles.kcalTrack}>
            <View style={[styles.kcalFill, { width: `${Math.min(100, Math.round((totalKcal / effTarget) * 100))}%`, backgroundColor: totalKcal > effTarget ? c.danger : c.primary }]} />
          </View>
        )}
        {(trainingKcal > 0 || activityKcal > 0) && (
          <Text style={styles.bonusLine} numberOfLines={1}>
            {trainingKcal > 0 ? '🔥' : ''}{activityKcal > 0 ? '🚶' : ''}  {t('food.kcalExtra', { n: Math.max(trainingKcal, activityKcal) })}{activityKcal > 0 && steps > 0 ? t('food.stepsSuffix', { steps: steps.toLocaleString('de-DE') }) : ''}
          </Text>
        )}
        <View style={styles.macrosRow}>
          <View style={styles.macroItem}><View style={[styles.macroDot, { backgroundColor: c.accent }]} /><Text style={styles.macroTxt}>{t('food.gProtein', { n: totalP })}</Text></View>
          <View style={styles.macroItem}><View style={[styles.macroDot, { backgroundColor: '#E69500' }]} /><Text style={styles.macroTxt}>{t('food.gCarbs', { n: totalC })}</Text></View>
          <View style={styles.macroItem}><View style={[styles.macroDot, { backgroundColor: c.danger }]} /><Text style={styles.macroTxt}>{t('food.gFat', { n: totalF })}</Text></View>
        </View>
      </View>

      {/* "Sprich's einfach": Mahlzeit in Sprache eingeben -> KI erkennt automatisch */}
      <View style={styles.nlCard}>
        <GlassFill radius={14} />
        <Text style={styles.nlTitle}>{t('food.nlTitle')}</Text>
        <Text style={styles.nlConsentHint}>{t('food.nlConsentHint')}</Text>
        <TextInput
          style={styles.nlInput}
          value={nlText}
          onChangeText={setNlText}
          placeholder={t('food.nlPlaceholder')}
          placeholderTextColor={c.textMuted}
          multiline
          editable={!nlBusy}
        />
        <TouchableOpacity style={[styles.nlBtn, isPremium && (nlBusy || !nlText.trim()) && { opacity: 0.5 }]} onPress={recognizeMeal} disabled={isPremium && (nlBusy || !nlText.trim())} activeOpacity={0.85}>
          {nlBusy && !nlItems ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.nlBtnText}>{isPremium ? t('food.nlRecognize') : t('food.nlRecognizePremium')}</Text>}
        </TouchableOpacity>
        {nlErr && <Text style={styles.error}>{nlErr}</Text>}
      </View>

      <Text style={styles.disclaimer}>{legalShort.nutritionDisclaimer}</Text>

      {/* Aktionen */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.addBtnRow} onPress={() => openPick(mealByHour())} activeOpacity={0.85}>
          <Text style={styles.addText}>{t('food.addAction')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.scanBtn} onPress={() => { if (!isPremium) { openPaywall('scan'); return; } setError(null); setScannerOpen(true); }} activeOpacity={0.85}>
          <GlassFill radius={14} />
          <Text style={styles.scanText}>{isPremium ? t('food.scan') : t('food.scanLocked')}</Text>
        </TouchableOpacity>
      </View>

      {/* "Mein üblicher Tag": die übliche Mahlzeit mit 1 Tipp hinzufügen */}
      {showUsual && usual && (
        <View style={styles.usualCard}>
          <GlassFill radius={14} />
          <View style={{ flex: 1 }}>
            <Text style={styles.usualTitle}>{t('food.usualTitle', { meal: TRACKER_MEALS.find((m) => m.key === curMeal)?.label ?? t('food.aMeal') })}</Text>
            <Text style={styles.usualItems} numberOfLines={2}>{usual.items.map((i) => i.food.name).join(' · ')}  ·  {usual.kcal} kcal</Text>
          </View>
          <TouchableOpacity style={styles.usualBtn} onPress={() => addUsual(curMeal)} disabled={busyRef.current} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('food.a11yAddUsual', { meal: TRACKER_MEALS.find((m) => m.key === curMeal)?.label ?? t('food.aMeal') })}>
            <Text style={styles.usualBtnText}>{t('food.oneTap')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.allergyNote}><Text style={styles.allergyText}>{legalShort.allergyHint}</Text></View>

      {/* Schnellzugriff */}
      {quickFoods.length > 0 && (
        <View style={styles.quickWrap}>
          <Text style={styles.sectionHead}>{t('food.quickAccess')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }} keyboardShouldPersistTaps="handled">
            {quickFoods.map((qf) => (
              <TouchableOpacity key={qf.food.id} style={styles.quickChip} onPress={() => quickAdd(qf)} activeOpacity={0.8}>
                <GlassFill radius={12} />
                <Text style={styles.quickName} numberOfLines={1}>{qf.food.name}</Text>
                <Text style={styles.quickMeta}>+{qf.amount} g · {Math.round((qf.food.kcal * qf.amount) / 100)} kcal</Text>
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
              <Text style={styles.mealTitle}>{m.icon}  {m.label}</Text>
              <View style={styles.mealHeaderRight}>
                {mealKcal > 0 && <Text style={styles.mealKcal}>{mealKcal} kcal</Text>}
                <TouchableOpacity style={styles.mealAdd} onPress={() => openPick(m.key)} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('food.a11yAddToMeal', { meal: m.label })}>
                  <Text style={styles.mealAddText}>＋</Text>
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
                    <Text style={styles.entryMeta}>{e.amount_g} g</Text>
                  </View>
                  <Text style={styles.entryKcal}>{kcalOf(e)} kcal</Text>
                  <TouchableOpacity onPress={() => deleteLog(e.id)} style={styles.del} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('food.a11yRemoveEntry', { name: e.food?.name ?? t('food.entry') })}><Text style={styles.delText}>✕</Text></TouchableOpacity>
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.nlOverlay}>
        <View style={styles.nlSheet}>
          <Text style={styles.nlSheetTitle}>{t('food.nlSheetTitle')}</Text>
          <Text style={styles.nlMealLabel}>{t('food.nlWhichMeal')}</Text>
          <View style={styles.nlMealRow}>
            {TRACKER_MEALS.map((m) => {
              const active = nlMeal === m.key;
              return (
                <TouchableOpacity key={m.key} onPress={() => setNlMealAll(m.key)} style={[styles.nlChip, active && styles.nlChipActive]} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ selected: active }}>
                  <GlassFill radius={999} />
                  <Text style={[styles.nlChipText, active && styles.nlChipTextActive]}>{m.icon} {m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
            {(nlItems ?? []).map((it, idx) => (
              <View key={idx} style={[styles.entryRow, idx > 0 && styles.entryDivider]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryName} numberOfLines={1}>{it.name}</Text>
                  <View style={styles.nlAmtRow}>
                    <TextInput
                      style={[styles.nlAmtInput, it.amount_g < 1 && { borderColor: c.danger }]}
                      value={it.amount_g ? String(it.amount_g) : ''}
                      onChangeText={(t) => setNlAmount(idx, t)}
                      keyboardType="number-pad"
                      selectTextOnFocus
                      maxLength={6}
                      placeholder="0"
                      placeholderTextColor={c.textMuted}
                      accessibilityLabel={t('food.a11yAmountFor', { name: it.name })}
                    />
                    <Text style={styles.nlAmtUnit}>g</Text>
                    <Text style={styles.entryMeta} numberOfLines={1}>  ·  {Math.round((it.kcal * it.amount_g) / 100)} kcal</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setNlItems((cur) => (cur ?? []).filter((_, i) => i !== idx))} style={styles.del} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('food.a11yRemoveItem', { name: it.name })}>
                  <Text style={styles.delText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
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
      </KeyboardAvoidingView>
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
    allergyNote: { backgroundColor: c.inputBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: c.cardBorder, marginBottom: 10 },
    allergyText: { fontSize: 12, color: c.text, lineHeight: 16, fontWeight: '600' },
    back: { color: c.primary, fontSize: 15, fontWeight: '600', marginBottom: 10 },
    addText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
    actionRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    addBtnRow: { flex: 1, backgroundColor: c.primary, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
    scanBtn: { flex: 1, backgroundColor: c.card, borderWidth: 1, borderColor: c.primary, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
    scanText: { color: c.primary, fontSize: 16, fontWeight: '700' },
    quickWrap: { marginBottom: 12 },
    quickChip: { ...shadow, backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, maxWidth: 200 },
    quickName: { fontSize: 14, fontWeight: '700', color: c.heading },
    quickMeta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    quickMsg: { fontSize: 13, color: c.success, marginTop: 10, fontWeight: '600' },
    sectionHead: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: c.textMuted, marginBottom: 6, marginLeft: 2 },

    todayCard: { ...shadow, backgroundColor: c.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: c.cardBorder },
    todayRow: { flexDirection: 'row', alignItems: 'center' },
    todayCol: { flex: 1, alignItems: 'center' },
    todayVal: { fontSize: 22, fontWeight: 'bold', color: c.heading },
    todayLbl: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    todaySep: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: c.border },
    kcalTrack: { height: 7, backgroundColor: c.track, borderRadius: 4, overflow: 'hidden', marginTop: 12 },
    kcalFill: { height: 7, borderRadius: 4 },
    macrosRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    macroItem: { flexDirection: 'row', alignItems: 'center' },
    macroDot: { width: 9, height: 9, borderRadius: 5, marginRight: 6 },
    macroTxt: { fontSize: 12, color: c.text, fontWeight: '600' },
    bonusLine: { fontSize: 12, fontWeight: '700', color: c.primary, textAlign: 'center', marginTop: 8 },

    mealCard: { ...shadow, backgroundColor: c.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, borderWidth: 1, borderColor: c.cardBorder },
    entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    entryDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    entryName: { fontSize: 15, color: c.text, fontWeight: '600' },
    entryMeta: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    entryKcal: { fontSize: 14, color: c.heading, fontWeight: '700', marginRight: 10 },
    del: { padding: 4 },
    delText: { fontSize: 16, color: c.textMuted },
    mealChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    mealChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border },
    mealChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    mealChipText: { fontSize: 14, fontWeight: '600', color: c.text },
    mealChipTextActive: { color: c.onPrimary },
    mealHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    mealTitle: { fontSize: 16, fontWeight: '700', color: c.heading },
    mealHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    mealKcal: { fontSize: 13, fontWeight: '700', color: c.textMuted },
    mealAdd: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    mealAddText: { fontSize: 16, color: c.primary, fontWeight: '700', lineHeight: 18 },
    mealEmpty: { fontSize: 12, color: c.textMuted, fontStyle: 'italic', paddingVertical: 3, paddingLeft: 2 },
    usualCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, borderWidth: 1, borderColor: c.primary },
    usualTitle: { fontSize: 14, fontWeight: '800', color: c.heading },
    usualItems: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    usualBtn: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginLeft: 10 },
    usualBtnText: { color: c.onPrimary, fontWeight: '800', fontSize: 14 },
    nlCard: { backgroundColor: c.card, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: c.primary },
    nlTitle: { fontSize: 14, fontWeight: '800', color: c.heading, marginBottom: 4 },
    nlConsentHint: { fontSize: 12, color: c.textMuted, lineHeight: 16, marginBottom: 8 },
    consentBody: { fontSize: 14, color: c.text, lineHeight: 20, marginBottom: 18 },
    nlInput: { borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: c.inputBg, color: c.text, minHeight: 44 },
    nlBtn: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
    nlBtnText: { color: c.onPrimary, fontSize: 15, fontWeight: '800' },
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
    foodRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: c.cardBorder },
    foodName: { fontSize: 16, color: c.text, fontWeight: '600' },
    foodMeta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    foodKcal: { fontSize: 14, color: c.primary, fontWeight: '700', marginLeft: 8 },
    foodDel: { paddingHorizontal: 6, paddingVertical: 4, marginLeft: 6 },
    foodDelText: { fontSize: 16 },
    newFoodBtn: { borderWidth: 1, borderColor: c.primary, borderRadius: 16, paddingVertical: 13, alignItems: 'center', marginTop: 10, backgroundColor: c.card },
    newFoodText: { color: c.primary, fontSize: 15, fontWeight: '700' },
    noResult: { fontSize: 14, color: c.textMuted, textAlign: 'center', marginTop: 18, lineHeight: 20 },
    macroRow: { flexDirection: 'row', gap: 10 },
    macroCol: { flex: 1 },
    error: { color: c.danger, fontSize: 14, marginTop: 14, textAlign: 'center' },
  });
}
