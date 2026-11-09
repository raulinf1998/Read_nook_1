import { useEffect, useState } from 'react';

export type PetDayNight = 'day' | 'night';

/** La fase procede del servidor, no del reloj ni la zona horaria del navegador. */
export function usePetDayNight(): PetDayNight {
  const [phase, setPhase] = useState<PetDayNight>('day');
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const refresh = async () => {
      let delay = 30_000;
      try {
        const response = await fetch('/api/pet/day-night', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Reloj del servidor no disponible');
        const data = await response.json();
        if ((data.phase !== 'day' && data.phase !== 'night') || !Number.isFinite(data.serverTime) || !Number.isFinite(data.nextTransition)) throw new Error('Reloj inválido');
        if (!stopped) setPhase(data.phase);
        // Volvemos a consultar al servidor, incluso si cambia su zona o su reloj.
        delay = Math.max(250, Math.min(60_000, data.nextTransition - data.serverTime + 100));
      } catch { /* Conserva la última fase conocida y reintenta. */ }
      if (!stopped) timer = setTimeout(refresh, delay);
    };
    void refresh();
    return () => { stopped = true; controller.abort(); if (timer) clearTimeout(timer); };
  }, []);
  return phase;
}
