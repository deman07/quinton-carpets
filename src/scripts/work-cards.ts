/**
 * The work gallery: one card open at a time.
 *
 * Hovering, focusing or tapping a card opens it, and it stays open
 * until another is chosen. The tracks go in a custom property, so the
 * CSS decides whether they run across (wide screens) or down (phones).
 */

const list = document.querySelector<HTMLElement>("#workCards");

if (list) {
  const cards = Array.from(list.querySelectorAll<HTMLElement>(".work-card"));

  const open = (i: number) => {
    cards.forEach((card, j) => (card.dataset.active = String(j === i)));
    list.style.setProperty("--tracks", cards.map((_, j) => (j === i ? "5fr" : "1fr")).join(" "));
  };

  cards.forEach((card, i) => {
    for (const type of ["mouseenter", "focus", "click"]) card.addEventListener(type, () => open(i));
  });
}
