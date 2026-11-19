export function installKeyboardInset() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  if (!viewport) return;

  let frame = 0;

  const update = () => {
    frame = 0;
    const inset = Math.max(
      0,
      Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
    );
    root.style.setProperty("--keyboard-inset", `${inset}px`);
  };

  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(update);
  };

  viewport.addEventListener("resize", schedule);
  viewport.addEventListener("scroll", schedule);
  window.addEventListener("orientationchange", schedule);
  update();

  document.addEventListener("focusin", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    window.setTimeout(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 280);
  });
}
