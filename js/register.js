/* BloodLink — left panel pointer parallax (does not touch the form) */
(() => {
  'use strict';
  const panel = document.getElementById('visualPanel');
  if (!panel) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(hover:hover)').matches) return;
  let raf = null, x = 0, y = 0;
  panel.addEventListener('pointermove', (e) => {
    const r = panel.getBoundingClientRect();
    x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (!raf) raf = requestAnimationFrame(() => {
      panel.style.setProperty('--mx', x.toFixed(3));
      panel.style.setProperty('--my', y.toFixed(3));
      raf = null;
    });
  });
  panel.addEventListener('pointerleave', () => {
    panel.style.setProperty('--mx', 0);
    panel.style.setProperty('--my', 0);
  });
})();