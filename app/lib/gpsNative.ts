// Laedt die NATIVEN GPS-/Karten-Module (expo-location, react-native-maps, expo-keep-awake)
// GESCHUETZT und LAZY. Grund: Diese Module sind nur in einem NEUEN Build vorhanden. So kann der
// GPS-Code auch im aktuellen 1.1-Build (ohne die Module) geladen werden, ohne zu crashen -
// gpsAvailable() ist dort false und der Einstieg wird ausgeblendet.
let _loc: any = null;
let _maps: any = null;
let _wake: any = null;
let _checked = false;

function load() {
  if (_checked) return;
  _checked = true;
  try { _loc = require('expo-location'); } catch {}
  try { _maps = require('react-native-maps'); } catch {}
  try { _wake = require('expo-keep-awake'); } catch {}
}

// true, wenn Standort + Karte verfuegbar sind (also: neuer Build).
export function gpsAvailable(): boolean {
  load();
  return !!_loc && !!(_maps?.default);
}

export function getLocation(): any { load(); return _loc; }
export function getMapView(): any { load(); return _maps?.default ?? null; }
export function getPolyline(): any { load(); return _maps?.Polyline ?? null; }
export function getMarker(): any { load(); return _maps?.Marker ?? null; }

// Bildschirm waehrend der Aufzeichnung wachhalten (kein Auto-Lock).
export function keepAwake(on: boolean) {
  load();
  try {
    if (on) _wake?.activateKeepAwakeAsync?.('fitavo-run');
    else _wake?.deactivateKeepAwake?.('fitavo-run');
  } catch {}
}
