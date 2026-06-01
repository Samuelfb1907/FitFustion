import { useEffect, useRef } from 'react';

// Ruft fn() auf, wenn sich `tick` aendert – aber NICHT beim ersten Mount.
// Wird genutzt, damit ein Reiter beim Antippen auf seine Startansicht zurueckspringt
// und seine Daten leise neu laedt, ohne den Bereich komplett neu zu mounten.
export function useFocusTick(tick: number | undefined, fn: () => void) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
}
