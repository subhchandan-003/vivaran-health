// Scroll-reveal — a one-shot IntersectionObserver that adds .is-visible to
// [data-reveal] elements the first time they enter the viewport. Elements
// start hidden/offset via the [data-reveal] CSS rule in style.css; this
// module is purely the trigger, so it stays a couple of lines wherever it's
// called: `observeReveal(content)` after painting a card grid.
export function observeReveal(root = document) {
  const targets = root.querySelectorAll("[data-reveal]:not(.is-visible)");
  if (targets.length === 0) return;

  if (!("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 },
  );

  targets.forEach((el) => observer.observe(el));
}
