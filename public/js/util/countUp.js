// Animates a stat number counting up from 0 to its target value. Skips
// straight to the final value under prefers-reduced-motion, so it never
// fights the app-wide reduced-motion override in style.css.
export function countUp(el, target, { duration = 700 } = {}) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion || !Number.isFinite(target) || target <= 0) {
    el.textContent = String(target);
    return;
  }

  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = String(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
