/* BloodLink homepage
 * ---------------------------------------------------------------
 * 1. Hero        canvas donor network with a beating "needs blood" drop
 * 2. Page        nav, scroll progress, split-text reveals, counters,
 *                journey vein, compatibility explorer, FAQ, pointer FX
 * 3. Cells       red blood cells drifting through the urgent section
 * 4. CTA         rising hearts in the final call to action
 * 5. News        live announcements preview (falls back to topic cards)
 *
 * All motion respects prefers-reduced-motion, and every animation loop
 * pauses when its section is off screen or the tab is hidden.
 */
(() => {
  'use strict';

  /* ---------- Shared helpers ---------- */
  const root = document.documentElement;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => motionQuery.matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
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

  /* ---------- Blood compatibility (red cells) ---------- */
  const TYPES = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
  const ABO_OK = { O: ['O'], A: ['A', 'O'], B: ['B', 'O'], AB: ['A', 'B', 'AB', 'O'] };
  const parse = (t) => ({ abo: t.slice(0, -1), rh: t.slice(-1) });
  const pretty = (t) => t.replace('-', '−');
  function canGive(donor, recipient) {
    const d = parse(donor), r = parse(recipient);
    if (r.rh === '-' && d.rh === '+') return false;
    return ABO_OK[r.abo].indexOf(d.abo) !== -1;
  }

  /* =============================================================
     1. HERO — donor-matching network
     ============================================================= */
  function initHero() {
    const CONFIG = {
      nodes: { wide: 26, compact: 16 },
      compactBelow: 520,
      maxDpr: 2,
      rippleSpeed: 0.85,
      intro: { start: 0.25, stagger: 0.03, duration: 0.9 },
      firstRippleDelay: 1100,
      demoOrder: ['A+', 'O-', 'AB+', 'B-', 'O+', 'A-', 'B+', 'AB-'],
      demoEvery: 4200,
      pointerRadius: 120,
      pointerPush: 26,
      parallax: 10,
      scrollSpread: 0.4,
      beat: 1.1             // seconds per heartbeat of the central drop
    };

    const hero = $('#hero');
    const visual = $('#heroVisual');
    const canvas = $('#heroCanvas');
    const content = $('#heroContent');
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (!hero || !visual || !content || !ctx) { root.classList.add('is-ready'); return; }

    const glow = $('.hero-glow', hero);
    const chips = $$('.chip', hero);
    const resultEl = $('#matcherResult');
    const cardCount = $('#cardCount');
    const cardNote = $('#cardNote');
    const demoBtn = $('#demoToggle');

    const WEIGHT = { 'O+': 38, 'A+': 34, 'B+': 9, 'O-': 7, 'A-': 6, 'AB+': 3, 'B-': 2, 'AB-': 1 };
    const FACTS = {
      'O-': 'O− can only receive red cells from O−.',
      'AB+': 'AB+ can receive red cells from every type.'
    };
    // lub-dub: two gaussian bumps per beat
    const heartbeat = (t) => {
      const p = (t % CONFIG.beat) / CONFIG.beat;
      return Math.exp(-Math.pow((p - 0.06) / 0.035, 2)) + 0.6 * Math.exp(-Math.pow((p - 0.24) / 0.04, 2));
    };

    let w = 0, h = 0, cx = 0, cy = 0, dpr = 1, scale = 1;
    let nodes = [];
    let sel = null, selAt = 0;
    const ripples = [];
    let t0 = 0, introAt = 0, last = 0, raf = 0;
    let inView = true, pageVisible = !document.hidden, started = false;
    let tp = 0, sp = 0, px = 0, py = 0;
    const ptr = { on: false, cx: 0, cy: 0, x: 0, y: 0, init: false, str: 0 };
    const applied = { sp: -1, px: -1, py: -1 };
    let auto = true, nextAuto = 0, demoIdx = 0;

    function buildNodes(count) {
      const rand = mulberry32(11);
      const pts = [];
      let minD = 0.3, tries = 0, guard = 0;
      while (pts.length < count && guard++ < 20000) {
        if (++tries > 500) { minD *= 0.92; tries = 0; }
        const a = rand() * Math.PI * 2;
        const rr = Math.sqrt(rand());
        const nx = Math.cos(a) * rr, ny = Math.sin(a) * rr;
        if (Math.hypot(nx, ny) < 0.36) continue;          // room for the drop
        if (nx > 0.5 && ny < -0.55) continue;             // card: top right
        if (nx < -0.45 && ny > 0.5) continue;             // card: bottom left
        if (pts.some((p) => Math.hypot(p.nx - nx, p.ny - ny) < minD)) continue;
        pts.push({ nx, ny });
      }
      pts.sort((a, b) => Math.hypot(a.nx, a.ny) - Math.hypot(b.nx, b.ny));

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
          t: bag[i], nx: p.nx, ny: p.ny, d, r0: 10 + d * 5.5,
          ph: rand() * 6.283, fx: 0.5 + rand() * 0.5, fy: 0.4 + rand() * 0.5,
          ax: 4 + rand() * 5, ay: 4 + rand() * 5,
          curve: (rand() < 0.5 ? -1 : 1) * (0.12 + rand() * 0.16),
          pph: rand(), act: 0, target: 0, fireAt: 0, hit: 0, x: 0, y: 0, e: 0
        };
      });
    }

    function select(type, opts) {
      const o = opts || {};
      sel = type;
      selAt = performance.now() + (o.lead || 0);
      const speed = Math.max(w, h) * CONFIG.rippleSpeed;
      let count = 0;
      nodes.forEach((n) => {
        const ok = canGive(n.t, type);
        if (ok) count++;
        n.target = ok ? 1 : 0;
        n.fireAt = selAt + (Math.hypot(n.nx * w * 0.46, n.ny * h * 0.46) / speed) * 1000;
        n.hit = 0;
        if (reduced()) n.act = n.target;
      });
      if (!reduced()) { ripples.push(selAt); if (ripples.length > 3) ripples.shift(); }
      if (o.user) { auto = false; syncDemo(); }
      if (auto) nextAuto = selAt + CONFIG.demoEvery;
      updateUI(type, count, nodes.length);
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
      resultEl.setAttribute('aria-live', auto ? 'off' : 'polite');
    }

    function resize() {
      const cw = visual.clientWidth, ch = visual.clientHeight;
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
      const ox = motion ? px : 0, oy = motion ? py : 0;
      const speed = Math.max(w, h) * CONFIG.rippleSpeed;
      const maxR = Math.hypot(w, h) / 2;
      const beat = motion ? heartbeat(t) : 0;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      /* orbit rings + satellites */
      const ringA = clamp(introT / 1.2);
      const r1x = w * 0.43 * spread, r1y = h * 0.34 * spread, rot1 = -0.4 + t * 0.02;
      const r2x = w * 0.3 * spread, r2y = h * 0.44 * spread, rot2 = 0.58 - t * 0.015;
      const ocx = cx + ox * 6, ocy = cy + oy * 6;
      drawRing(r1x, r1y, rot1, 0.2 * ringA * fade, ocx, ocy);
      drawRing(r2x, r2y, rot2, 0.13 * ringA * fade, ocx, ocy);
      const sat = (rx, ry, rot, ang, r, a) => {
        const sx = rx * Math.cos(ang), sy = ry * Math.sin(ang);
        ctx.fillStyle = 'rgba(201,24,53,' + (a * ringA * fade).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(ocx + sx * Math.cos(rot) - sy * Math.sin(rot), ocy + sx * Math.sin(rot) + sy * Math.cos(rot), r, 0, Math.PI * 2);
        ctx.fill();
      };
      sat(r1x, r1y, rot1, t * 0.35, 3.2, 0.55);
      sat(r2x, r2y, rot2, -t * 0.27 + 2, 2.4, 0.4);

      /* heartbeat pulse rings from the drop */
      const dcx = cx - ox * 8, dcy = cy - oy * 6 + 4;
      if (motion && introT > 1) {
        const p = (t % CONFIG.beat) / CONFIG.beat;
        const pr = (58 + p * 150) * scale;
        ctx.beginPath();
        ctx.arc(dcx, dcy + 6 * scale, pr, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(201,24,53,' + ((1 - p) * 0.16 * fade).toFixed(3) + ')';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      /* request ripples */
      if (motion) {
        for (let i = ripples.length - 1; i >= 0; i--) {
          const rr = ((now - ripples[i]) / 1000) * speed;
          if (rr < 0) continue;
          if (rr > maxR) { ripples.splice(i, 1); continue; }
          const k = 1 - rr / maxR;
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(201,24,53,' + (k * 0.38).toFixed(3) + ')';
          ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(0, rr - 14), 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(201,24,53,' + (k * 0.12).toFixed(3) + ')';
          ctx.lineWidth = 6;
          ctx.stroke();
        }
      }

      /* donor positions */
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.e = easeOutCubic(clamp((introT - CONFIG.intro.start - i * CONFIG.intro.stagger) / CONFIG.intro.duration));
        let x = cx + n.nx * w * 0.46 * spread + (motion ? Math.sin(t * n.fx + n.ph) * n.ax : 0) + ox * n.d * CONFIG.parallax;
        let y = cy + n.ny * h * 0.46 * spread + (motion ? Math.cos(t * n.fy + n.ph) * n.ay : 0) + oy * n.d * CONFIG.parallax;
        if (ptr.str > 0.01) {
          const dx = x - ptr.x, dy = y - ptr.y, dist = Math.hypot(dx, dy);
          if (dist < CONFIG.pointerRadius && dist > 0.001) {
            const f = Math.pow(1 - dist / CONFIG.pointerRadius, 2) * CONFIG.pointerPush * ptr.str;
            x += (dx / dist) * f; y += (dy / dist) * f;
          }
        }
        n.x = lerp(cx, x, n.e);
        n.y = lerp(cy, y, n.e);
      }

      /* links + travelling blood cells (donor -> person in need) */
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
        ctx.strokeStyle = 'rgba(201,24,53,' + ((0.18 + 0.3 * n.act) * fade).toFixed(3) + ')';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        if (motion && n.act > 0.98) {
          for (let k = 0; k < 2; k++) {
            const tt = (t * 0.45 + n.pph + k * 0.5) % 1;
            const p = bez(dcx, dcy, cxp, cyp, n.x, n.y, 1 - tt);
            const a = Math.sin(Math.PI * tt) * 0.9 * fade;
            ctx.save();
            ctx.translate(p[0], p[1]);
            ctx.rotate(Math.atan2(dy, dx));
            ctx.fillStyle = 'rgba(201,24,53,' + a.toFixed(3) + ')';
            ctx.beginPath(); ctx.ellipse(0, 0, 3.4, 2.2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
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

        // "lit" flash when the ripple reaches a compatible donor
        if (motion && n.target === 1 && now >= n.fireAt) {
          const ht = (now - n.fireAt) / 700;
          if (ht < 1) {
            ctx.beginPath();
            ctx.arc(n.x, n.y, rad * (1 + ht * 1.6), 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(238,34,68,' + ((1 - ht) * 0.5 * a).toFixed(3) + ')';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }

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

      drawDrop(t, introT, now, dcx, dcy, fade, beat);
    }

    function drawDrop(t, introT, now, x, y, fade, beat) {
      if (!DROP) return;
      const grow = easeOutBack(clamp((introT - 0.05) / 0.9));
      const k = 1.12 * scale * grow * (reduced() ? 1 : 1 - sp * 0.16) * (1 + 0.045 * beat);
      if (k <= 0.02) return;
      const bob = reduced() ? 0 : Math.sin(t * 1.3) * 4 * scale;
      const dy = y + bob;

      const halo = ctx.createRadialGradient(x, dy, 0, x, dy, 170 * k);
      const ha = (0.46 + 0.18 * beat) * fade;
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

      // glossy inner light that shifts with the pointer
      ctx.save();
      ctx.clip(DROP);
      const gl = ctx.createRadialGradient(50 + px * 14, 70 + py * 10, 4, 50 + px * 14, 70 + py * 10, 90);
      gl.addColorStop(0, 'rgba(255,255,255,0.22)');
      gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(0, 0, 144, 180);
      ctx.restore();

      ctx.fillStyle = 'rgba(255,255,255,0.26)';
      ctx.beginPath(); ctx.ellipse(40, 96, 8, 22, 0.45, 0, Math.PI * 2); ctx.fill();

      if (sel) {
        const e = easeOutCubic(reduced() ? 1 : clamp((now - selAt) / 260));
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

      for (const n of nodes) {
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
    function loop(now) { raf = 0; step(now); if (shouldRun()) raf = requestAnimationFrame(loop); }
    function kick() { if (raf || !shouldRun()) return; last = performance.now(); raf = requestAnimationFrame(loop); }
    function paint() { if (!w || !nodes.length) return; if (reduced() || !raf) render(performance.now()); }

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
      new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; if (inView) kick(); }, { threshold: 0 }).observe(hero);
    }
    document.addEventListener('visibilitychange', () => { pageVisible = !document.hidden; if (pageVisible) kick(); });
    if ('ResizeObserver' in window) new ResizeObserver(() => { resize(); paint(); kick(); }).observe(visual);
    else window.addEventListener('resize', () => { resize(); paint(); });

    function applyMotionPreference() {
      if (reduced()) {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        auto = false; ripples.length = 0;
        nodes.forEach((n) => { n.act = n.target; });
        if (demoBtn) demoBtn.hidden = true;
        clearDom(); syncDemo(); paint();
      } else {
        if (demoBtn) demoBtn.hidden = false;
        kick();
      }
    }
    if (motionQuery.addEventListener) motionQuery.addEventListener('change', applyMotionPreference);

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
        syncDemo(); paint();
      } else {
        select('A+', { lead: CONFIG.firstRippleDelay });
        syncDemo(); kick();
      }
    });
  }

  /* =============================================================
     2. PAGE — navigation, reveals and interactions
     ============================================================= */
  function initPage() {
    const nav = $('#navbar');
    const navLinks = $('#navLinks');
    const toggle = $('#menuToggle');
    const bar = $('#scrollProgress');
    const track = $('#journeyTrack');
    const jCards = track ? $$('.journey-card', track) : [];

    /* Split headings into words for a staggered rise */
    $$('[data-split]').forEach((el) => {
      let i = 0;
      const walk = (node) => {
        Array.from(node.childNodes).forEach((ch) => {
          if (ch.nodeType === 3) {
            const frag = document.createDocumentFragment();
            ch.textContent.split(/(\s+)/).forEach((part) => {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
              const wrap = document.createElement('span');
              wrap.className = 'w';
              const inner = document.createElement('span');
              inner.textContent = part;
              inner.style.setProperty('--i', i++);
              wrap.appendChild(inner);
              frag.appendChild(wrap);
            });
            node.replaceChild(frag, ch);
          } else if (ch.nodeType === 1 && ch.tagName !== 'BR') {
            walk(ch);
          }
        });
      };
      walk(el);
    });

    /* Section reveals */
    const items = $$('.reveal-section');
    if (reduced() || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
    } else {
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { entry.target.classList.add('is-visible'); obs.unobserve(entry.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      items.forEach((item) => {
        const sibs = item.parentElement ? $$(':scope > .reveal-section', item.parentElement) : [item];
        item.style.transitionDelay = Math.min(sibs.indexOf(item), 3) * 100 + 'ms';
        io.observe(item);
      });
    }

    /* Sections that pause their loops when off screen */
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => e.target.classList.toggle('in-view', e.isIntersecting));
      }, { threshold: 0.18 });
      $$('[data-inview]').forEach((el) => io.observe(el));
    } else {
      $$('[data-inview]').forEach((el) => el.classList.add('in-view'));
    }

    /* Counters */
    const counters = $$('[data-count]');
    const runCount = (el) => {
      const target = Number(el.dataset.count) || 0;
      if (reduced()) { el.textContent = target; return; }
      const start = performance.now(), dur = 1400;
      const tick = (now) => {
        const p = clamp((now - start) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(tick);
      };
      el.textContent = '0';
      requestAnimationFrame(tick);
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach((e) => { if (e.isIntersecting) { runCount(e.target); obs.unobserve(e.target); } });
      }, { threshold: 0.6 });
      counters.forEach((c) => io.observe(c));
    }

    /* Mobile menu */
    const setMenu = (open) => {
      if (!navLinks || !toggle) return;
      navLinks.classList.toggle('open', open);
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    };
    if (toggle) toggle.addEventListener('click', () => setMenu(!navLinks.classList.contains('open')));
    if (navLinks) $$('a', navLinks).forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinks && navLinks.classList.contains('open')) { setMenu(false); toggle.focus(); }
    });

    /* Active link follows the section in view */
    const linkFor = {};
    $$('[data-target]', navLinks || document).forEach((a) => { linkFor[a.dataset.target] = a; });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          Object.values(linkFor).forEach((a) => a.classList.remove('active'));
          const a = linkFor[e.target.id];
          if (a) a.classList.add('active');
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      Object.keys(linkFor).forEach((id) => { const s = document.getElementById(id); if (s) io.observe(s); });
    }

    /* Scroll-driven: progress bar, nav state, journey vein */
    let lastY = window.scrollY, ticking = false;
    function onScroll() {
      ticking = false;
      const y = window.scrollY;
      const max = root.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? clamp(y / max) : 0).toFixed(4) + ')';
      if (nav) {
        nav.classList.toggle('is-scrolled', y > 12);
        const menuOpen = navLinks && navLinks.classList.contains('open');
        if (!menuOpen && y > lastY + 4 && y > 480) nav.classList.add('is-hidden');
        else if (y < lastY - 4 || y <= 480) nav.classList.remove('is-hidden');
      }
      lastY = y;
      if (track) {
        const r = track.getBoundingClientRect();
        const vh = window.innerHeight;
        const p = reduced() ? 1 : clamp((vh * 0.85 - r.top) / (vh * 0.55));
        track.style.setProperty('--p', p.toFixed(3));
        track.style.setProperty('--head', p > 0.01 && p < 0.99 ? '1' : '0');
        jCards.forEach((c, i) => c.classList.toggle('is-lit', p >= i / Math.max(1, jCards.length - 1) - 0.001));
      }
    }
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();

    /* Pointer effects: spotlight, tilt, magnetic (fine pointers only) */
    if (finePointer) {
      $$('[data-spotlight]').forEach((el) => {
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect();
          el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
          el.style.setProperty('--my', (e.clientY - r.top) + 'px');
        });
      });
      $$('[data-tilt]').forEach((el) => {
        el.addEventListener('pointermove', (e) => {
          if (reduced()) return;
          const r = el.getBoundingClientRect();
          const nx = (e.clientX - r.left) / r.width - 0.5;
          const ny = (e.clientY - r.top) / r.height - 0.5;
          el.style.transform = 'perspective(900px) rotateX(' + (-ny * 7).toFixed(2) + 'deg) rotateY(' + (nx * 9).toFixed(2) + 'deg) translateY(-6px)';
        });
        el.addEventListener('pointerleave', () => { el.style.transform = ''; });
      });
      $$('[data-magnetic]').forEach((el) => {
        el.addEventListener('pointermove', (e) => {
          if (reduced()) return;
          const r = el.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2);
          const dy = e.clientY - (r.top + r.height / 2);
          el.style.transform = 'translate(' + (dx * 0.2).toFixed(1) + 'px,' + (dy * 0.3).toFixed(1) + 'px)';
        });
        el.addEventListener('pointerleave', () => { el.style.transform = ''; });
      });
    }

    /* Compatibility explorer */
    const compat = $('#compat');
    if (compat) {
      const tiles = $$('.blood-type-tile', compat);
      const readout = $('#compatReadout');
      const link = $('#compatLink');
      const modeBtns = $$('.compat-mode button', compat);
      const pill = $('.compat-mode .pill', compat);
      let mode = 'receive', current = 'A+';

      const movePill = () => {
        const a = modeBtns.find((b) => b.dataset.mode === mode);
        if (!a || !pill) return;
        pill.style.width = a.offsetWidth + 'px';
        pill.style.transform = 'translateX(' + (a.offsetLeft - 5) + 'px)';
      };
      const update = () => {
        tiles.forEach((t) => {
          t.classList.remove('is-match', 'is-selected');
          t.style.removeProperty('--k');
          t.setAttribute('aria-pressed', String(t.dataset.type === current));
        });
        if (!current) {
          compat.classList.remove('has-selection');
          readout.textContent = 'Pick a blood type below.';
          link.href = 'donorSearch.html';
          $('.label', link).textContent = 'Explore donors';
          return;
        }
        compat.classList.add('has-selection');
        const list = [];
        let k = 0;
        tiles.forEach((t) => {
          const ty = t.dataset.type;
          const ok = mode === 'receive' ? canGive(ty, current) : canGive(current, ty);
          if (ty === current) t.classList.add('is-selected');
          if (ok) { t.classList.add('is-match'); t.style.setProperty('--k', k++); list.push(pretty(ty)); }
        });
        const who = '<b>' + pretty(current) + '</b>';
        let note = '';
        if (mode === 'give' && current === 'O-') note = ' <em>Universal red cell donor.</em>';
        if (mode === 'receive' && current === 'AB+') note = ' <em>Universal red cell recipient.</em>';
        readout.innerHTML = (mode === 'receive'
          ? who + ' can receive red cells from <b>' + list.join(', ') + '</b>.'
          : who + ' can give red cells to <b>' + list.join(', ') + '</b>.') + note;
        link.href = 'donorSearch.html?type=' + encodeURIComponent(current);
        $('.label', link).textContent = 'Find ' + pretty(current) + ' donors';
      };

      tiles.forEach((t) => t.addEventListener('click', () => {
        current = current === t.dataset.type ? null : t.dataset.type;
        update();
      }));
      modeBtns.forEach((b) => b.addEventListener('click', () => {
        mode = b.dataset.mode;
        modeBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        movePill();
        update();
      }));
      window.addEventListener('resize', movePill);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(movePill);
      movePill();
      update();
    }

    /* FAQ: smooth open/close, one answer at a time */
    const faqs = $$('.faq-list details');
    const ease = 'cubic-bezier(.2,.8,.2,1)';
    const closeFaq = (d) => {
      const body = $('.faq-body', d);
      if (!body || reduced() || !body.animate) { d.open = false; return; }
      d.dataset.busy = '1';
      const anim = body.animate([{ height: body.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 320, easing: ease });
      anim.onfinish = () => { d.open = false; delete d.dataset.busy; };
    };
    const openFaq = (d) => {
      d.open = true;
      const body = $('.faq-body', d);
      if (!body || reduced() || !body.animate) return;
      body.animate([{ height: '0px', opacity: 0 }, { height: body.scrollHeight + 'px', opacity: 1 }], { duration: 440, easing: ease });
    };
    faqs.forEach((d) => {
      $('summary', d).addEventListener('click', (e) => {
        e.preventDefault();
        if (d.dataset.busy) return;
        if (d.open) closeFaq(d);
        else { faqs.forEach((o) => { if (o !== d && o.open) closeFaq(o); }); openFaq(d); }
      });
    });
  }

  /* =============================================================
     3. CELLS — red blood cells drifting through the urgent section
     ============================================================= */
  function initCells() {
    const c = $('#cellsCanvas');
    if (!c || !c.getContext) return;
    const g = c.getContext('2d');
    const sec = c.parentElement;
    const rand = mulberry32(7);
    let w = 0, h = 0, dpr = 1, cells = [], raf = 0, last = 0, inView = false, t = 0;

    function build() {
      const n = Math.round(clamp((w * h) / 15000, 14, 48));
      cells = [];
      for (let i = 0; i < n; i++) {
        const depth = 0.3 + rand() * 0.7;
        cells.push({
          x: rand() * w, y: rand() * h, depth,
          r: (5 + rand() * 9) * (0.55 + depth * 0.8),
          vx: (16 + rand() * 28) * depth,
          ph: rand() * 6.28, rot: rand() * 6.28, vr: (rand() - 0.5) * 0.9,
          a: 0.15 + depth * 0.5
        });
      }
      cells.sort((a, b) => a.depth - b.depth);
    }
    function resize() {
      const r = sec.getBoundingClientRect();
      if (!r.width || !r.height) return;
      w = r.width; h = r.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      build();
      draw(0);
    }
    function cell(p) {
      const squash = 0.35 + 0.65 * Math.abs(Math.cos(p.rot));
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot * 0.3);
      g.scale(1, squash);
      g.globalAlpha = p.a;
      const grd = g.createRadialGradient(-p.r * 0.3, -p.r * 0.3, p.r * 0.1, 0, 0, p.r);
      grd.addColorStop(0, '#ff7d8f'); grd.addColorStop(0.55, '#d01d3d'); grd.addColorStop(1, '#7d0820');
      g.fillStyle = grd;
      g.beginPath(); g.arc(0, 0, p.r, 0, Math.PI * 2); g.fill();
      // the biconcave dip in the middle
      g.fillStyle = 'rgba(90,4,22,0.35)';
      g.beginPath(); g.arc(p.r * 0.05, p.r * 0.05, p.r * 0.45, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    function draw(dt) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      t += dt;
      for (const p of cells) {
        if (dt) {
          p.x += p.vx * dt;
          p.y += Math.sin(t * 0.7 + p.ph + p.x * 0.006) * 12 * dt * p.depth;
          p.rot += p.vr * dt;
          if (p.x - p.r * 2 > w) { p.x = -p.r * 2; p.y = rand() * h; }
        }
        cell(p);
      }
    }
    const canRun = () => inView && !reduced() && !document.hidden && w > 0;
    function loop(now) { raf = 0; draw(Math.min(0.05, (now - last) / 1000)); last = now; if (canRun()) raf = requestAnimationFrame(loop); }
    function kick() { if (raf || !canRun()) return; last = performance.now(); raf = requestAnimationFrame(loop); }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((e) => { inView = e[0].isIntersecting; kick(); }).observe(sec);
    }
    document.addEventListener('visibilitychange', kick);
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(sec);
    else window.addEventListener('resize', resize);
    resize();
  }

  /* =============================================================
     4. CTA — rising hearts
     ============================================================= */
  function initCta() {
    const bub = $('#ctaBubbles');
    if (!bub || reduced()) return;
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.textContent = '♥';
      s.style.setProperty('--x', (Math.random() * 100).toFixed(1) + '%');
      s.style.setProperty('--s', (0.6 + Math.random() * 1.1).toFixed(2));
      s.style.setProperty('--dur', (7 + Math.random() * 7).toFixed(1) + 's');
      s.style.setProperty('--delay', (-Math.random() * 14).toFixed(1) + 's');
      s.style.setProperty('--drift', ((Math.random() - 0.5) * 80).toFixed(0) + 'px');
      bub.appendChild(s);
    }
  }

  /* =============================================================
     5. ANNOUNCEMENTS — live preview from the announcements store
     Uses window.BloodLinkAds (ads-data.js). If it is missing or
     there are no upcoming listings, the static topic cards stay.
     ============================================================= */
  function initAnnouncements() {
    const grid = $('#newsGrid');
    const countEl = $('#newsCount');
    const A = window.BloodLinkAds;
    if (!grid || !A || typeof A.load !== 'function') return;

    const escape = typeof A.esc === 'function' ? A.esc
      : (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fallback = grid.innerHTML;
    const rank = { premium: 0, featured: 1, basic: 2 };
    const fmtTime = (t) => (t && typeof A.formatTime === 'function' ? A.formatTime(t) : t || '');

    function upcoming() {
      try {
        const today = typeof A.today === 'function' ? A.today() : new Date().toISOString().slice(0, 10);
        return A.load()
          .filter((a) => a && a.eventDate && a.eventDate >= today && (typeof A.status !== 'function' || A.status(a) === 'Active'))
          .sort((x, y) => (rank[x.plan] ?? 2) - (rank[y.plan] ?? 2)
            || x.eventDate.localeCompare(y.eventDate)
            || String(x.startTime || '').localeCompare(String(y.startTime || '')));
      } catch (e) { return []; }
    }

    function card(a) {
      const color = (A.CATEGORIES && A.CATEGORIES[a.category] && A.CATEGORIES[a.category].color) || '#c91835';
      const d = new Date(a.eventDate + 'T12:00:00');
      const day = isNaN(d) ? '' : d.getDate();
      const mon = isNaN(d) ? '' : d.toLocaleDateString('en', { month: 'short' });
      const time = [fmtTime(a.startTime), fmtTime(a.endTime)].filter(Boolean).join(' – ');
      const sponsored = a.plan && a.plan !== 'basic' ? ' · Sponsored' : '';
      return '<a class="news-card" href="ads.html#' + encodeURIComponent(a.id) + '" style="--accent:' + escape(color) + '" data-spotlight>'
        + '<div class="news-top"><span class="news-date"><b>' + day + '</b><span>' + escape(mon) + '</span></span>'
        + (a.badge ? '<span class="news-badge">' + escape(a.badge) + '</span>' : '') + '</div>'
        + '<span class="news-cat">' + escape(a.category || 'Announcement') + sponsored + '</span>'
        + '<h3>' + escape(a.title) + '</h3>'
        + '<p>' + escape(a.hospital) + (a.department ? ' · ' + escape(a.department) : '') + '</p>'
        + '<div class="news-foot"><span>' + escape(time || 'See details') + '</span><span class="go" aria-hidden="true">↗</span></div>'
        + '</a>';
    }

    function bindSpotlight() {
      if (!finePointer) return;
      $$('[data-spotlight]', grid).forEach((el) => {
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect();
          el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
          el.style.setProperty('--my', (e.clientY - r.top) + 'px');
        });
      });
    }

    function render() {
      const list = upcoming();
      if (!list.length) {
        grid.innerHTML = fallback;
        if (countEl) countEl.hidden = true;
      } else {
        grid.innerHTML = list.slice(0, 3).map(card).join('');
        if (countEl) { countEl.textContent = list.length + ' upcoming'; countEl.hidden = false; }
      }
      bindSpotlight();
    }

    render();
    window.addEventListener('storage', (e) => { if (!A.KEY || e.key === A.KEY) render(); });
  }

  initHero();
  initPage();
  initCells();
  initCta();
  initAnnouncements();
})();