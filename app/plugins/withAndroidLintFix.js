// Eigenes Expo-Config-Plugin: schaltet die Android-Lint-Pruefungen "ExtraTranslation" und
// "MissingTranslation" fuer den Release-Build ab.
//
// Hintergrund: Die iOS-Berechtigungstexte aus app.json -> "locales" (NSCameraUsageDescription,
// NSMotionUsageDescription, NSPhotoLibraryUsageDescription) werden beim Android-Prebuild als
// lokalisierte String-Ressourcen erzeugt (res/values-b+de, res/values-b+en) - jedoch OHNE
// Eintrag in der Standard-Sprache. "lintVitalRelease" wertet das als fatalen ExtraTranslation-
// Fehler und bricht den Build ab. Diese Strings sind reine iOS-Info.plist-Texte und auf Android
// funktionslos -> die Pruefung kann hier gefahrlos deaktiviert werden (andere Lint-Checks bleiben
// aktiv). Greift beim EAS-Build im Prebuild-Schritt.
const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withAndroidLintFix(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes('disable "ExtraTranslation"')) return cfg; // schon vorhanden
    // lint{}-Block direkt nach dem oeffnenden "android {" einfuegen.
    gradle = gradle.replace(
      /android\s*\{/,
      'android {\n    lint {\n        disable "ExtraTranslation", "MissingTranslation"\n    }',
    );
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
