import { useEffect, useState } from 'react';

const FALLBACK_TIP = 'Conecta 4 piezas en línea para ganar.';

export function useDailyTip() {
  const [tip, setTip] = useState<string>(FALLBACK_TIP);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetch('https://api.adviceslip.com/advice')
      .then(res => res.json())
      .then((data: { slip: { advice: string } }) => {
        if (active) setTip(data.slip.advice);
      })
      .catch(() => {
        if (active) setTip(FALLBACK_TIP);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { tip, loading };
}
