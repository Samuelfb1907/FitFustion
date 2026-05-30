// Start-Screen für EINGELOGGTE Nutzer.
// Zeigt vorerst eine Begrüßung, die Muskelgruppen aus der DB und einen Logout-Button.
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type Muscle = { id: string; name_de: string; body_region: string | null };

export default function HomeScreen() {
  const { session, profile } = useAuth();
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('muscles')
      .select('id, name_de, body_region')
      .order('name_de')
      .then(({ data }) => {
        setMuscles(data ?? []);
        setLoading(false);
      });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    // AuthContext bemerkt das automatisch -> zurück zum Login
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Hallo, {profile?.first_name || 'willkommen'}! 👋</Text>
          <Text style={styles.email}>{session?.user.email}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Muskelgruppen</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#1F3864" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={muscles}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowText}>{item.name_de}</Text>
              <Text style={styles.rowSub}>{item.body_region}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  hello: { fontSize: 24, fontWeight: 'bold', color: '#1F3864' },
  email: { fontSize: 14, color: '#777', marginTop: 2 },
  logoutBtn: {
    borderWidth: 1,
    borderColor: '#CFD8E3',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  logoutText: { color: '#2E5496', fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
  rowText: { fontSize: 17, color: '#222' },
  rowSub: { fontSize: 13, color: '#999' },
});
