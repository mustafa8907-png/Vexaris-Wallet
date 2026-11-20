export function installKeyboardInset() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  if (!viewport) return;

  let frame = 0;
  let last = -1;

  const update = () => {
    frame = 0;
    const raw = Math.round(window.innerHeight - viewport.height - viewport.offsetTop);
    const inset = raw < 24 ? 0 : raw;
    if (inset === last) return;
    last = inset;
    root.style.setProperty("--keyboard-inset", `${inset}px`);
  };

  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(update);
  };

  viewport.addEventListener("resize", schedule);
  viewport.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("orientationchange", schedule);
  update();

  document.addEventListener(
    "focusin",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (!window.matchMedia("(pointer: coarse)").matches) return;
      window.setTimeout(() => {
        const visibleBottom = window.innerHeight - Math.max(0, last);
        const rect = target.getBoundingClientRect();
        if (rect.bottom > visibleBottom - 12) {
          target.scrollIntoView({ block: "nearest" });
        }
      }, 320);
    },
    { passive: true },
  );
}
