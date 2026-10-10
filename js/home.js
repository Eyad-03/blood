/* BloodLink hero: donor-matching network
 * ---------------------------------------------------------------
 * A blood drop (the person who needs blood) sits at the centre of a
 * field of sample donors. Choosing a blood type sends a ripple out
 * from the drop; donors the ripple reaches light up if they can give
 * to that type, and a link grows from the drop to each of them.
 *
 * Motion layers
 *   1. Entrance      one sequence on load (headline, copy, network)
 *   2. Interaction   ripple + links on selection, pointer parallax and
 *                    gentle repel
 *   3. Scroll        network spreads, copy eases away as you leave
 *
 * Everything is sample data, not live donors. Respects
 * prefers-reduced-motion (static frame, no loop, no autoplay).
 * Loop only runs while the hero is visible and the tab is active.
 */
(() => {
  'use strict';

  /* ---------- Settings: tweak here ---------- */
  const CONFIG = {
    nodes: { wide: 26, compact: 16 },
    compactBelow: 520,        // canvas width (px) that switches to fewer donors
    maxDpr: 2,
    rippleSpeed: 0.85,        // canvas longest side per second
    intro: { start: 0.25, stagger: 0.03, duration: 0.9 },
    firstRippleDelay: 1100,   // ms after load, so the entrance finishes first
    demoOrder: ['A+', 'O-', 'AB+', 'B-', 'O+', 'A-', 'B+', 'AB-'],
    demoEvery: 4200,          // ms between automatic selections
    pointerRadius: 120,
    pointerPush: 26,
    parallax: 10,             // px of drift per unit of node depth
    scrollSpread: 0.4         // how far the network opens up by the end of the hero
  };

  const root = document.documentElement;
  const hero = document.getElementById('hero');
  const visual = document.getElementById('heroVisual');
  const canvas = document.getElementById('heroCanvas');
  const content = document.getElementById('heroContent');
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;

  // Without a canvas, the page still works: reveal the copy and stop.
  if (!hero || !visual || !content || !ctx) {
    root.classList.add('is-ready');
    return;
  }

  const glow = hero.querySelector('.hero-glow');
  const chips = Array.from(hero.querySelectorAll('.chip'));
  const resultEl = document.getElementById('matcherResult');
  const cardCount = document.getElementById('cardCount');
  const cardNote = document.getElementById('cardNote');
  const demoBtn = document.getElementById('demoToggle');

  /* ---------- Blood compatibility (red cells) ---------- */
  const TYPES = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
  const WEIGHT = { 'O+': 38, 'A+': 34, 'B+': 9, 'O-': 7, 'A-': 6, 'AB+': 3, 'B-': 2, 'AB-': 1 };
  const ABO_OK = { O: ['O'], A: ['A', 'O'], B: ['B', 'O'], AB: ['A', 'B', 'AB', 'O'] };
  const FACTS = {
    'O-': 'O\u2212 can only receive red cells from O\u2212.',
    'AB+': 'AB+ can receive red cells from every type.'
  };
  const parse = (t) => ({ abo: t.slice(0, -1), rh: t.slice(-1) });
  const pretty = (t) => t.replace('-', '\u2212');
  function canGive(donor, recipient) {
    const d = parse(donor);
    const r = parse(recipient);
    if (r.rh === '-' && d.rh === '+') return false;
    return ABO_OK[r.abo].indexOf(d.abo) !== -1;
  }

  /* ---------- Small helpers ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
  const mulberry32 = (a) => () => {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => motionQuery.matches;

  /* ---------- State ---------- */
  let w = 0, h = 0, cx = 0, cy = 0, dpr = 1, scale = 1;
  let nodes = [];
  let sel = null;
  let selAt = 0;
  const ripples = [];

  let t0 = 0, introAt = 0, last = 0, raf = 0;
  let inView = true, pageVisible = !document.hidden, started = false;

  let tp = 0, sp = 0;                    // scroll progress: target, smoothed
  let px = 0, py = 0;                    // smoothed pointer parallax, -1..1
  const ptr = { on: false, cx: 0, cy: 0, x: 0, y: 0, init: false, str: 0 };
  const applied = { sp: -1, px: -1, py: -1 };

  let auto = true, nextAuto = 0, demoIdx = 0;

  /* ---------- Donor field ---------- */
  function buildNodes(count) {
    const rand = mulberry32(11);
    const pts = [];
    let minD = 0.3, tries = 0, guard = 0;
    while (pts.length < count && guard++ < 20000) {
      if (++tries > 500) { minD *= 0.92; tries = 0; }
      const a = rand() * Math.PI * 2;
      const rr = Math.sqrt(rand());
      const nx = Math.cos(a) * rr;
      const ny = Math.sin(a) * rr;
      if (Math.hypot(nx, ny) < 0.36) continue;                 // room for the drop
      if (nx > 0.5 && ny < -0.55) continue;                    // card: top right
      if (nx < -0.5 && ny > 0.5) continue;                     // card: bottom left
      if (pts.some((p) => Math.hypot(p.nx - nx, p.ny - ny) < minD)) continue;
      pts.push({ nx, ny });
    }
    pts.sort((a, b) => Math.hypot(a.nx, a.ny) - Math.hypot(b.nx, b.ny));

    // every type appears at least once, the rest follow real-world frequency
    const bag = TYPES.slice();
    const total = TYPES.reduce((s, t) => s + WEIGHT[t], 0);
    while (bag.length < pts.length) {
      let r = rand() * total;
      for (const t of TYPES) { r -= WEIGHT[t]; if (r <= 0) { bag.push(t); break; } }
    }
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }

    return pts.map((p, i) => {
      const d = 0.6 + rand() * 0.8;
      return {
        t: bag[i], nx: p.nx, ny: p.ny, d,
        r0: 10 + d * 5.5,
        ph: rand() * 6.283, fx: 0.5 + rand() * 0.5, fy: 0.4 + rand() * 0.5,
        ax: 4 + rand() * 5, ay: 4 + rand() * 5,
        curve: (rand() < 0.5 ? -1 : 1) * (0.12 + rand() * 0.16),
        pph: rand(),
        act: 0, target: 0, fireAt: 0,
        x: 0, y: 0, e: 0
      };
    });
  }

  /* ---------- Selection ---------- */
  function select(type, opts) {
    const o = opts || {};
    const now = performance.now();
    sel = type;
    selAt = now + (o.lead || 0);
    const speed = Math.max(w, h) * CONFIG.rippleSpeed;
    let count = 0;
    nodes.forEach((n) => {
      const ok = canGive(n.t, type);
      if (ok) count++;
      n.target = ok ? 1 : 0;
      const dist = Math.hypot(n.nx * w * 0.46, n.ny * h * 0.46);
      n.fireAt = selAt + (dist / speed) * 1000;
      if (reduced()) n.act = n.target;
    });
    if (!reduced()) {
      ripples.push(selAt);
      if (ripples.length > 3) ripples.shift();
    }
    if (o.user) { auto = false; syncDemo(); }
    if (auto) nextAuto = selAt + CONFIG.demoEvery;
    updateUI(type, count, nodes.length, !!o.user || !auto);
  }

  function updateUI(type, count, total) {
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.type === type)));
    const label = pretty(type);
    const fact = FACTS[type] ? ' ' + FACTS[type] : '';
    resultEl.innerHTML = '<b>' + count + ' of ' + total + '</b> sample donors can give to <b>' + label + '</b>.' + fact;
    cardCount.textContent = count + ' compatible donors';
    cardNote.textContent = 'Sample view for ' + label;
    cardCount.classList.remove('tick');
    void cardCount.offsetWidth;
    cardCount.classList.add('tick');
  }

  function syncDemo() {
    if (!demoBtn) return;
    demoBtn.textContent = auto ? 'Pause' : 'Play';
    demoBtn.setAttribute('aria-label', auto ? 'Pause the demo cycle' : 'Play the demo cycle');
    resultEl.setAttribute('aria-live', auto ? 'off' : 'polite');   // never announce the autoplay
  }

  /* ---------- Layout ---------- */
  function resize() {
    const cw = visual.clientWidth;
    const ch = visual.clientHeight;
    if (!cw || !ch) return;
    w = cw; h = ch; cx = w / 2; cy = h / 2;
    dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    scale = Math.max(0.68, Math.min(1.15, Math.min(w, h) / 560));

    const want = w < CONFIG.compactBelow ? CONFIG.nodes.compact : CONFIG.nodes.wide;
    if (want !== nodes.length) {
      nodes = buildNodes(want);
      if (sel) { const keepAuto = auto; select(sel, { lead: 0 }); auto = keepAuto; }
    }
  }

  /* ---------- Drawing ---------- */
  const DROP = typeof Path2D === 'function'
    ? new Path2D('M 72 0 C 54 36 0 85 0 116 A 72 58 0 0 0 144 116 C 144 85 90 36 72 0 Z')
    : null;

  function bez(p0x, p0y, cxp, cyp, p1x, p1y, u) {
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    return [a * p0x + b * cxp + c * p1x, a * p0y + b * cyp + c * p1y];
  }

  function drawRing(rx, ry, rot, alpha, dx, dy) {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(201,24,53,' + alpha.toFixed(3) + ')';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function render(now) {
    const motion = !reduced();
    const t = motion ? (now - t0) / 1000 : 0;
    const introT = motion ? (now - introAt) / 1000 : 99;
    const spread = motion ? 1 + sp * CONFIG.scrollSpread : 1;
    const fade = motion ? 1 - sp * 0.45 : 1;
    const ox = motion ? px : 0;
    const oy = motion ? py : 0;
    const speed = Math.max(w, h) * CONFIG.rippleSpeed;
    const maxR = Math.hypot(w, h) / 2;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    /* orbit rings + one satellite */
    const ringA = clamp(introT / 1.2);
    const r1x = w * 0.43 * spread, r1y = h * 0.34 * spread, rot1 = -0.4 + t * 0.02;
    drawRing(r1x, r1y, rot1, 0.2 * ringA * fade, cx + ox * 6, cy + oy * 6);
    drawRing(w * 0.3 * spread, h * 0.44 * spread, 0.58 - t * 0.015, 0.13 * ringA * fade, cx + ox * 6, cy + oy * 6);
    if (motion || introT > 1) {
      const ang = t * 0.35;
      const sx = r1x * Math.cos(ang), sy = r1y * Math.sin(ang);
      const x = cx + ox * 6 + sx * Math.cos(rot1) - sy * Math.sin(rot1);
      const y = cy + oy * 6 + sx * Math.sin(rot1) + sy * Math.cos(rot1);
      ctx.fillStyle = 'rgba(201,24,53,' + (0.55 * ringA * fade).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
    }

    /* request ripples */
    if (motion) {
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rr = ((now - ripples[i]) / 1000) * speed;
        if (rr < 0) continue;
        if (rr > maxR) { ripples.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(201,24,53,' + ((1 - rr / maxR) * 0.38).toFixed(3) + ')';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }

    /* donor positions */
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const local = clamp((introT - CONFIG.intro.start - i * CONFIG.intro.stagger) / CONFIG.intro.duration);
      n.e = easeOutCubic(local);
      let x = cx + n.nx * w * 0.46 * spread + (motion ? Math.sin(t * n.fx + n.ph) * n.ax : 0) + ox * n.d * CONFIG.parallax;
      let y = cy + n.ny * h * 0.46 * spread + (motion ? Math.cos(t * n.fy + n.ph) * n.ay : 0) + oy * n.d * CONFIG.parallax;
      if (ptr.str > 0.01) {
        const dx = x - ptr.x, dy = y - ptr.y;
        const dist = Math.hypot(dx, dy);
        if (dist < CONFIG.pointerRadius && dist > 0.001) {
          const f = Math.pow(1 - dist / CONFIG.pointerRadius, 2) * CONFIG.pointerPush * ptr.str;
          x += (dx / dist) * f; y += (dy / dist) * f;
        }
      }
      n.x = lerp(cx, x, n.e);
      n.y = lerp(cy, y, n.e);
    }

    /* links, then travelling pulses */
    const dcx = cx - ox * 8;
    const dcy = cy - oy * 6 + 4;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.act < 0.004 || n.e < 0.5) continue;
      const mx = (dcx + n.x) / 2, my = (dcy + n.y) / 2;
      const dx = n.x - dcx, dy = n.y - dcy;
      const cxp = mx - dy * n.curve, cyp = my + dx * n.curve;
      const steps = Math.max(2, Math.ceil(24 * n.act));
      ctx.beginPath();
      ctx.moveTo(dcx, dcy);
      for (let s = 1; s <= steps; s++) {
        const p = bez(dcx, dcy, cxp, cyp, n.x, n.y, (n.act * s) / steps);
        ctx.lineTo(p[0], p[1]);
      }
      ctx.strokeStyle = 'rgba(201,24,53,' + ((0.2 + 0.32 * n.act) * fade).toFixed(3) + ')';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      if (motion && n.act > 0.98) {
        for (let k = 0; k < 2; k++) {
          const tt = (t * 0.45 + n.pph + k * 0.5) % 1;
          const p = bez(dcx, dcy, cxp, cyp, n.x, n.y, 1 - tt);   // donor -> person in need
          ctx.fillStyle = 'rgba(201,24,53,' + (Math.sin(Math.PI * tt) * 0.9 * fade).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(p[0], p[1], 2.6, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    /* donors */
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.e <= 0.001) continue;
      const a = n.e * fade;
      const rad = n.r0 * scale * (1 + 0.14 * n.act) * (0.6 + 0.4 * n.e);
      const label = pretty(n.t);

      if (n.act > 0.02) {
        const g = ctx.createRadialGradient(n.x, n.y, rad * 0.6, n.x, n.y, rad * 2);
        g.addColorStop(0, 'rgba(201,24,53,' + (0.22 * n.act * a).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(201,24,53,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(n.x, n.y, rad * 2, 0, Math.PI * 2); ctx.fill();
      }

      ctx.globalAlpha = a;
      const base = ctx.createRadialGradient(n.x - rad * 0.3, n.y - rad * 0.35, rad * 0.1, n.x, n.y, rad);
      base.addColorStop(0, '#fff6f8'); base.addColorStop(0.6, '#f3e1e6'); base.addColorStop(1, '#e0c8cf');
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.arc(n.x, n.y, rad, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e8d3d9'; ctx.lineWidth = 1; ctx.stroke();

      if (n.act > 0.01) {
        ctx.globalAlpha = a * n.act;
        const hot = ctx.createRadialGradient(n.x - rad * 0.3, n.y - rad * 0.35, rad * 0.1, n.x, n.y, rad);
        hot.addColorStop(0, '#ff9ba9'); hot.addColorStop(0.35, '#ed344f'); hot.addColorStop(0.7, '#c10d31'); hot.addColorStop(1, '#8f0824');
        ctx.fillStyle = hot;
        ctx.beginPath(); ctx.arc(n.x, n.y, rad, 0, Math.PI * 2); ctx.fill();
      }

      ctx.font = '800 ' + (rad * 0.74).toFixed(1) + 'px Manrope, "DM Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = a * (1 - n.act);
      ctx.fillStyle = '#a8979e';
      ctx.fillText(label, n.x, n.y + 0.5);
      ctx.globalAlpha = a * n.act;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, n.x, n.y + 0.5);
      ctx.globalAlpha = 1;
    }

    /* the person who needs blood */
    drawDrop(t, introT, now, dcx, dcy, fade);
  }

  function drawDrop(t, introT, now, x, y, fade) {
    if (!DROP) return;
    const grow = easeOutBack(clamp((introT - 0.05) / 0.9));
    const k = 1.12 * scale * grow * (reduced() ? 1 : 1 - sp * 0.16) * (1 + 0.012 * Math.sin(t * 1.6));
    if (k <= 0.02) return;
    const bob = reduced() ? 0 : Math.sin(t * 1.3) * 4 * scale;
    const dy = y + bob;

    const halo = ctx.createRadialGradient(x, dy, 0, x, dy, 170 * k);
    const ha = (0.5 + 0.1 * Math.sin(t * 1.1)) * fade;
    halo.addColorStop(0, 'rgba(245,183,194,' + ha.toFixed(3) + ')');
    halo.addColorStop(0.55, 'rgba(251,220,226,' + (ha * 0.55).toFixed(3) + ')');
    halo.addColorStop(1, 'rgba(255,238,241,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(x, dy, 170 * k, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.translate(x - 72 * k, dy - 83 * k);
    ctx.scale(k, k);
    ctx.shadowColor = 'rgba(164,14,45,0.35)';
    ctx.shadowBlur = 34 * dpr * k;
    ctx.shadowOffsetY = 20 * dpr * k;
    const body = ctx.createLinearGradient(0, 0, 144, 166);
    body.addColorStop(0.03, '#f0445e'); body.addColorStop(0.43, '#d21a3b'); body.addColorStop(1, '#a50b29');
    ctx.fillStyle = body;
    ctx.fill(DROP);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(255,255,255,0.26)';
    ctx.beginPath(); ctx.ellipse(40, 96, 8, 22, 0.45, 0, Math.PI * 2); ctx.fill();

    if (sel) {
      const lt = reduced() ? 1 : clamp((now - selAt) / 260);
      const e = easeOutCubic(lt);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * e).toFixed(3) + ')';
      ctx.font = '600 12px "DM Sans", sans-serif';
      ctx.fillText('needs', 72, 84);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.97 * e).toFixed(3) + ')';
      ctx.font = '800 ' + (40 * (0.85 + 0.15 * e)).toFixed(1) + 'px Manrope, "DM Sans", sans-serif';
      ctx.fillText(pretty(sel), 72, 114);
    }
    ctx.restore();
  }

  /* ---------- Frame loop ---------- */
  function step(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    const rect = visual.getBoundingClientRect();
    let pnx = 0, pny = 0;
    if (ptr.on) {
      const lx = ptr.cx - rect.left, ly = ptr.cy - rect.top;
      if (!ptr.init) { ptr.x = lx; ptr.y = ly; ptr.init = true; }
      ptr.x += (lx - ptr.x) * damp(14, dt);
      ptr.y += (ly - ptr.y) * damp(14, dt);
      pnx = clamp((lx / Math.max(1, w) - 0.5) * 2, -1, 1);
      pny = clamp((ly / Math.max(1, h) - 0.5) * 2, -1, 1);
    }
    ptr.str += ((ptr.on ? 1 : 0) - ptr.str) * damp(6, dt);
    px += (pnx - px) * damp(4, dt);
    py += (pny - py) * damp(4, dt);
    sp += (tp - sp) * damp(9, dt);

    applyDom();

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (now >= n.fireAt) {
        n.act += (n.target - n.act) * damp(5.5, dt);
        if (Math.abs(n.target - n.act) < 0.003) n.act = n.target;
      }
    }

    if (sel && auto && now >= nextAuto) {
      demoIdx = (demoIdx + 1) % CONFIG.demoOrder.length;
      select(CONFIG.demoOrder[demoIdx]);
    }

    render(now);
  }

  function applyDom() {
    if (Math.abs(sp - applied.sp) < 0.0004 && Math.abs(px - applied.px) < 0.0004 && Math.abs(py - applied.py) < 0.0004) return;
    applied.sp = sp; applied.px = px; applied.py = py;
    const fadeOut = clamp((sp - 0.35) / 0.55);
    content.style.transform = 'translate3d(0,' + (sp * 34).toFixed(1) + 'px,0)';
    content.style.opacity = (1 - fadeOut * fadeOut * 0.9).toFixed(3);
    visual.style.transform = 'translate3d(0,' + (-sp * 46).toFixed(1) + 'px,0) scale(' + (1 + sp * 0.05).toFixed(4) + ')';
    visual.style.setProperty('--px', px.toFixed(3));
    visual.style.setProperty('--py', py.toFixed(3));
    if (glow) glow.style.transform = 'translate3d(' + (px * 40).toFixed(1) + 'px,' + (py * 30 - sp * 60).toFixed(1) + 'px,0)';
  }

  function clearDom() {
    content.style.transform = ''; content.style.opacity = '';
    visual.style.transform = ''; visual.style.removeProperty('--px'); visual.style.removeProperty('--py');
    if (glow) glow.style.transform = '';
    applied.sp = applied.px = applied.py = -1;
  }

  const shouldRun = () => started && !reduced() && inView && pageVisible && w > 0;
  function loop(now) {
    raf = 0;
    step(now);
    if (shouldRun()) raf = requestAnimationFrame(loop);
  }
  function kick() {
    if (raf || !shouldRun()) return;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function paint() {
    if (!w || !sel && !nodes.length) return;
    if (reduced() || !raf) render(performance.now());
  }

  /* ---------- Events ---------- */
  chips.forEach((chip) => chip.addEventListener('click', () => select(chip.dataset.type, { user: true })));

  if (demoBtn) {
    demoBtn.addEventListener('click', () => {
      auto = !auto;
      if (auto) nextAuto = performance.now() + 1500;
      syncDemo();
      kick();
    });
  }

  window.addEventListener('scroll', () => {
    if (reduced()) return;
    tp = clamp(window.scrollY / Math.max(1, hero.offsetHeight * 0.85));
    kick();
  }, { passive: true });

  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || reduced()) return;
    ptr.cx = e.clientX; ptr.cy = e.clientY; ptr.on = true;
    kick();
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { ptr.on = false; ptr.init = false; kick(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      if (inView) kick();
    }, { threshold: 0 }).observe(hero);
  }
  document.addEventListener('visibilitychange', () => {
    pageVisible = !document.hidden;
    if (pageVisible) kick();
  });

  if ('ResizeObserver' in window) {
    new ResizeObserver(() => { resize(); paint(); kick(); }).observe(visual);
  } else {
    window.addEventListener('resize', () => { resize(); paint(); });
  }

  function applyMotionPreference() {
    if (reduced()) {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      auto = false; ripples.length = 0;
      nodes.forEach((n) => { n.act = n.target; });
      if (demoBtn) demoBtn.hidden = true;
      clearDom();
      syncDemo();
      paint();
    } else {
      if (demoBtn) demoBtn.hidden = false;
      kick();
    }
  }
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', applyMotionPreference);

  /* ---------- Start ---------- */
  resize();
  const fontsReady = Promise.race([
    document.fonts && document.fonts.load ? document.fonts.load('800 20px Manrope').catch(() => {}) : Promise.resolve(),
    new Promise((r) => setTimeout(r, 700))
  ]);

  fontsReady.then(() => {
    resize();
    root.classList.add('is-ready');
    t0 = introAt = performance.now();
    started = true;
    if (reduced()) {
      auto = false;
      if (demoBtn) demoBtn.hidden = true;
      select('A+', { lead: 0 });
      syncDemo();
      paint();
    } else {
      select('A+', { lead: CONFIG.firstRippleDelay });
      syncDemo();
      kick();
    }
  });
})();