// Faengt unerwartete Render-Fehler ab, damit nicht die ganze App weiss/schwarz
// wird (White-Screen of Death). Zeigt eine freundliche Meldung + "Erneut
// versuchen". Bewusst eigenstaendige Farben (kein Theme-Hook), falls der Fehler
// im Theme/Provider liegt. Spaeter kann componentDidCatch an Sentry o.ae. melden.
import { Component, ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string }) {
    // Nur Konsole, keine personenbezogenen Daten. Anker fuer spaeteres Crash-Monitoring.
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.emoji}>😕</Text>
        <Text style={styles.title}>Etwas ist schiefgelaufen</Text>
        <Text style={styles.text}>
          Die App hatte einen unerwarteten Fehler. Tippe auf „Erneut versuchen". Falls es weiter
          passiert, schließe die App und öffne sie neu.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={this.reset} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.btnText}>Erneut versuchen</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#0B0F0E' },
  emoji: { fontSize: 44, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#F2F5F4', marginBottom: 8, textAlign: 'center' },
  text: { fontSize: 14, color: '#9AA5A1', lineHeight: 20, textAlign: 'center', marginBottom: 24 },
  btn: { backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28 },
  btnText: { color: '#06201A', fontSize: 16, fontWeight: '700' },
});
