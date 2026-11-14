import { useEffect, useRef, useState } from "react";

/** Yumuşak sayı animasyonu — bakiye gibi değerler için. */
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    // Sekme arka plandayken requestAnimationFrame durur; animasyon takılıp
    // bakiye 0'da kalmasın diye değeri doğrudan yaz.
    if (typeof document !== "undefined" && document.hidden) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = target;
    };

    frame = requestAnimationFrame(tick);

    // rAF beklenmedik şekilde durursa son değeri yine de uygula.
    const settle = window.setTimeout(() => {
      fromRef.current = target;
      setValue(target);
    }, duration + 120);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [target, duration]);

  return value;
}
