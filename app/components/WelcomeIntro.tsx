// Value-/Intro-Overlay vor der Registrierung: 3 schlanke Slides (werbefrei,
// KI-Foto-Logging, Koerper-Karte/Fortschritt, DSGVO). Dismissbar via
// "Ueberspringen" oder am Ende "Los geht's". Reines JS, in Expo Go testbar.
// Liegt als absolutes Overlay ueber dem AuthScreen-Inhalt; setzt selbst KEIN
// AsyncStorage-Flag (das macht der Aufrufer via onDone).
import { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, Colors } from '../contexts/ThemeContext';
import { useT } from '../contexts/LanguageContext';
import Ambient from './Ambient';
import Glass from './Glass';

type SlideDef = { icon: keyof typeof Ionicons.glyphMap; titleKey: string; bodyKey: string };

const SLIDES: SlideDef[] = [
  { icon: 'sparkles-outline', titleKey: 'welcome.slide1.title', bodyKey: 'welcome.slide1.body' },
  { icon: 'camera-outline', titleKey: 'welcome.slide2.title', bodyKey: 'welcome.slide2.body' },
  { icon: 'shield-checkmark-outline', titleKey: 'welcome.slide3.title', bodyKey: 'welcome.slide3.body' },
];

export default function WelcomeIntro({ onDone }: { onDone: () => void }) {
  const c = useColors();
  const t = useT();
  const styles = makeStyles(c);
  const { width: W } = Dimensions.get('window');
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const isLast = index >= SLIDES.length - 1;

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / W);
    if (i !== index) setIndex(i);
  }

  function next() {
    if (isLast) { onDone(); return; }
    const target = (index + 1) * W;
    scrollRef.current?.scrollTo({ x: target, animated: true });
    setIndex(index + 1);
  }

  return (
    <View style={styles.root}>
      <Ambient c={c} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={onDone} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('welcome.skip')}>
          <Text style={styles.skip}>{t('welcome.skip')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.flex}
      >
        {SLIDES.map((s) => (
          <View key={s.titleKey} style={[styles.slide, { width: W }]}>
            <Glass radius={28} style={styles.iconWrap}>
              <Ionicons name={s.icon} size={56} color={c.primary} />
            </Glass>
            <Text style={styles.title}>{t(s.titleKey)}</Text>
            <Text style={styles.body}>{t(s.bodyKey)}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View key={s.titleKey} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cta} onPress={next} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.ctaText}>{isLast ? t('welcome.start') : t('welcome.next')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { ...StyleSheet.absoluteFillObject, backgroundColor: c.bg, zIndex: 10 },
    flex: { flex: 1 },
    topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: Platform.OS === 'android' ? 44 : 60, paddingHorizontal: 22, paddingBottom: 4 },
    skip: { fontSize: 14, fontWeight: '700', color: c.textMuted },
    slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
    iconWrap: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
    title: { fontSize: 26, fontWeight: '900', color: c.heading, textAlign: 'center', letterSpacing: 0.2 },
    body: { fontSize: 15, lineHeight: 22, color: c.textMuted, textAlign: 'center', marginTop: 14, maxWidth: 360 },
    dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.border, marginHorizontal: 4 },
    dotActive: { backgroundColor: c.primary, width: 22 },
    footer: { paddingHorizontal: 28, paddingBottom: Platform.OS === 'android' ? 28 : 44, paddingTop: 8 },
    cta: { backgroundColor: c.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
    ctaText: { color: c.onPrimary, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  });
}
