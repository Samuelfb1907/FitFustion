// Protein-Tracker (Reiter unter "Essen"): Referenzliste proteinreicher
// Lebensmittel, absteigend nach Protein-Gehalt pro 100 g sortiert. Mit Suche.
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors, Colors } from '../contexts/ThemeContext';
import GlassFill from '../components/GlassFill';
import { CARD_SHADOW as shadow } from '../lib/ui';
import { PROTEIN_FOODS } from '../lib/proteinFoods';

export default function ProteinScreen({ embedded }: { embedded?: boolean }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [search, setSearch] = useState('');

  // Einmal sortieren: meiste -> wenigste Protein (bei Gleichstand weniger kcal zuerst).
  const sorted = useMemo(
    () => [...PROTEIN_FOODS].sort((a, b) => b.protein - a.protein || a.kcal - b.kcal),
    [],
  );
  const q = search.trim().toLowerCase();
  const list = q ? sorted.filter((f) => f.name.toLowerCase().includes(q) || f.group.toLowerCase().includes(q)) : sorted;

  return (
    <FlatList
      style={[styles.container, embedded && styles.embedded, embedded && styles.bleed]}
      contentContainerStyle={[{ paddingBottom: 40 }, embedded && styles.bleedPad]}
      data={list}
      keyExtractor={(item) => item.name}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={20}
      maxToRenderPerBatch={20}
      windowSize={10}
      ListHeaderComponent={
        <View>
          {!embedded && <Text style={styles.title}>Protein</Text>}
          <View style={styles.introCard}>
            <GlassFill radius={16} />
            <Text style={styles.introTitle}>💪 Protein pro 100 g</Text>
            <Text style={styles.introText}>Sortiert von viel zu wenig. Die Werte sind Richtwerte und können je nach Produkt und Marke abweichen.</Text>
          </View>
          <TextInput
            style={styles.input}
            value={search}
            onChangeText={setSearch}
            placeholder="Suchen (z. B. Quark, Huhn, Tofu)…"
            placeholderTextColor={c.textMuted}
            autoCorrect={false}
          />
          <Text style={styles.countHint}>{list.length} Produkte</Text>
        </View>
      }
      renderItem={({ item, index }) => (
        <View style={styles.row}>
          <Text style={styles.rank}>{index + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.group} · {item.kcal} kcal</Text>
          </View>
          <View style={styles.proteinWrap}>
            <Text style={styles.protein}>{item.protein}<Text style={styles.proteinUnit}> g</Text></Text>
            <Text style={styles.proteinLbl}>Protein</Text>
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>Kein Treffer. Versuch ein anderes Stichwort.</Text>}
    />
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 56, paddingHorizontal: 16 },
    embedded: { paddingTop: 4, paddingHorizontal: 0, backgroundColor: 'transparent' },
    // Eingebettet im Essen-Hub (20px Rand): bis zum echten Bildschirmrand ziehen,
    // damit der Scroll-Balken rechts am Rand sitzt; Inhalt bleibt per bleedPad eingerueckt.
    bleed: { marginHorizontal: -20 },
    bleedPad: { paddingHorizontal: 20 },
    title: { fontSize: 26, fontWeight: '800', color: c.heading, marginBottom: 14 },
    introCard: { ...shadow, backgroundColor: c.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.cardBorder, marginBottom: 14 },
    introTitle: { fontSize: 16, fontWeight: '800', color: c.heading, marginBottom: 4 },
    introText: { fontSize: 13, color: c.textMuted, lineHeight: 18 },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, backgroundColor: c.inputBg, color: c.text },
    countHint: { fontSize: 12, color: c.textMuted, marginTop: 8, marginBottom: 4 },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, borderWidth: 1, borderColor: c.cardBorder },
    rank: { width: 30, fontSize: 14, fontWeight: '800', color: c.textMuted },
    name: { fontSize: 15, fontWeight: '700', color: c.heading },
    meta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    proteinWrap: { alignItems: 'flex-end', marginLeft: 10 },
    protein: { fontSize: 18, fontWeight: '800', color: c.primary },
    proteinUnit: { fontSize: 13, fontWeight: '700', color: c.primary },
    proteinLbl: { fontSize: 12, color: c.textMuted },
    empty: { fontSize: 14, color: c.textMuted, textAlign: 'center', marginTop: 18 },
  });
}
