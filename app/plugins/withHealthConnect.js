// Eigenes Expo-Config-Plugin fuer react-native-health-connect (Android).
// Das mitgelieferte Plugin fuegt nur den Rationale-Intent hinzu. Wir ergaenzen:
//   1) Health-Berechtigung READ_STEPS im Manifest
//   2) <queries> fuer die Health-Connect-App (Sichtbarkeit ab Android 11)
//   3) HealthConnectPermissionDelegate in MainActivity.onCreate registrieren
//      -> ohne das stuerzt requestPermission(...) ab (lateinit not initialized).
const { withAndroidManifest, withMainActivity } = require('@expo/config-plugins');

const HEALTH_PACKAGE = 'com.google.android.apps.healthdata';
const PERMISSIONS = ['android.permission.health.READ_STEPS'];

function withHealthPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    manifest['uses-permission'] = manifest['uses-permission'] || [];
    for (const name of PERMISSIONS) {
      const exists = manifest['uses-permission'].some((p) => p.$ && p.$['android:name'] === name);
      if (!exists) manifest['uses-permission'].push({ $: { 'android:name': name } });
    }

    manifest.queries = manifest.queries || [];
    const hasPkg = manifest.queries.some(
      (q) => Array.isArray(q.package) && q.package.some((p) => p.$ && p.$['android:name'] === HEALTH_PACKAGE),
    );
    if (!hasPkg) manifest.queries.push({ package: [{ $: { 'android:name': HEALTH_PACKAGE } }] });

    return cfg;
  });
}

function withPermissionDelegate(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') return cfg; // erwarten Kotlin (Expo SDK 54)
    let src = cfg.modResults.contents;
    const IMPORT = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
    const CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

    if (!src.includes(IMPORT)) {
      src = src.replace(/^(package .+)$/m, `$1\n\n${IMPORT}`);
    }
    if (!src.includes(CALL)) {
      src = src.replace(/(super\.onCreate\([^)]*\))/, `$1\n    ${CALL}`);
    }
    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = function withHealthConnect(config) {
  config = withHealthPermissions(config);
  config = withPermissionDelegate(config);
  return config;
};
