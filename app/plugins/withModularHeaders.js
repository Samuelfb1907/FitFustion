// Eigenes Expo-Config-Plugin: erzwingt in der iOS-Podfile modular headers fuer die Google-Pods.
//
// Hintergrund: GoogleSignIn 9.x (fuer Google-Login) zieht AppCheckCore, das von GoogleUtilities
// und RecaptchaInterop abhaengt. Diese definieren keine Module und koennen deshalb NICHT als
// statische Libraries in den Swift-Pod integriert werden -> "pod install" bricht ab mit:
//   "The following Swift pods cannot yet be integrated as static libraries".
// Fix (genau wie die Fehlermeldung vorschlaegt): :modular_headers => true fuer diese Pods.
// Greift beim EAS-Build im Prebuild-Schritt, nachdem die Podfile erzeugt wurde.
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = "pod 'GoogleUtilities', :modular_headers => true";
const PODS = [
  "  pod 'GoogleUtilities', :modular_headers => true",
  "  pod 'RecaptchaInterop', :modular_headers => true",
  "  pod 'AppCheckCore', :modular_headers => true",
].join('\n');

module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, ['ios', (cfg) => {
    const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
    let contents = fs.readFileSync(podfile, 'utf8');
    if (!contents.includes(MARKER)) {
      // Direkt nach der ersten "target '…' do"-Zeile einfuegen.
      contents = contents.replace(/(target ['"][^'"]+['"] do[^\n]*\n)/, `$1${PODS}\n`);
      fs.writeFileSync(podfile, contents);
    }
    return cfg;
  }]);
};
