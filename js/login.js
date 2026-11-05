/* ==========================================================
   BloodLink — Sign in
   1. Smoothed pointer parallax (left panel)
   2. Living donor network (canvas) pulsing with the heartbeat
   3. Rotating "match" notification
   4. Form: validation, password toggle, caps-lock hint,
      remember me, ripple + magnetic button, loading/success
   ========================================================== */
(() => {
  'use strict';

  /* ---------- Config: connect your backend here ---------- */
  const CONFIG = {
    loginEndpoint: '',               // e.g. '/api/auth/login' — empty = demo mode
    redirectTo: '/html/home.html',   // where to go after a successful sign-in
    resetUrl: '',                    // e.g. '/html/forgot-password.html'
    beatMs: 1600                     // keep in sync with --beat in login.css
  };

  const $ = (s, r = document) => r.querySelector(s);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const panel = $('#visualPanel');

  /* ---------- Toast ---------- */
  const toastEl = $('#toast');
  let toastTimer;
  function toast(text, ms = 3200) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  /* ================= 1. Parallax (lerped) ================= */
  const pointer = { x: -9999, y: -9999 }; // shared with the canvas (panel px)
  if (panel && finePointer && !reduceMotion) {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    const tick = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      panel.style.setProperty('--mx', cx.toFixed(3));
      panel.style.setProperty('--my', cy.toFixed(3));
      raf = (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) ? requestAnimationFrame(tick) : null;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    panel.addEventListener('pointermove', (e) => {
      const r = panel.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      tx = (pointer.x / r.width - 0.5) * 2;
      ty = (pointer.y / r.height - 0.5) * 2;
      kick();
    });
    panel.addEventListener('pointerleave', () => {
      tx = ty = 0; pointer.x = pointer.y = -9999; kick();
    });
  }

  /* ================= 2. Donor network ================= */
  (function network() {
    const canvas = $('#network');
    if (!canvas || !panel) return;
    const ctx = canvas.getContext('2d');
    const core = $('.core');
    const LINK = 135;
    let w = 0, h = 0, nodes = [], pulses = [], raf = null, visible = true, lastBeat = 0, lastRandom = 0;

    function build() {
      const r = panel.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(72, Math.max(26, (w * h) / 13000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.5 + 0.8, glow: 0
      }));
      pulses = [];
      return true;
    }

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const neighbours = (n, exclude) => nodes.filter((m) => m !== n && m !== exclude && dist(n, m) < LINK);

    function spawn(from, hops = 3, exclude) {
      const options = neighbours(from, exclude);
      if (!options.length) return;
      const to = options[(Math.random() * options.length) | 0];
      pulses.push({ a: from, b: to, t: 0, speed: 0.016 + Math.random() * 0.012, hops });
    }

    function corePoint() {
      if (!core) return { x: w / 2, y: h / 2 };
      const pr = panel.getBoundingClientRect(), cr = core.getBoundingClientRect();
      return { x: cr.left - pr.left + cr.width / 2, y: cr.top - pr.top + cr.height / 2 };
    }

    function heartbeat() {
      // a "request" radiates from the heart to the nearest donors
      const c = corePoint();
      const near = [...nodes].sort((a, b) => dist(a, c) - dist(b, c)).slice(0, 3);
      near.forEach((n) => { n.glow = 1; spawn(n, 4); });
    }

    function step() {
      for (const n of nodes) {
        // gentle repel from the pointer
        const dx = n.x - pointer.x, dy = n.y - pointer.y, d = Math.hypot(dx, dy);
        if (d < 110 && d > 0) { n.vx += (dx / d) * 0.03; n.vy += (dy / d) * 0.03; }
        n.vx *= 0.985; n.vy *= 0.985;
        const sp = Math.hypot(n.vx, n.vy);
        if (sp < 0.08) { n.vx += (Math.random() - 0.5) * 0.04; n.vy += (Math.random() - 0.5) * 0.04; }
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        n.glow *= 0.955;
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.t += p.speed;
        if (p.t >= 1) {
          p.b.glow = 1;
          pulses.splice(i, 1);
          if (p.hops > 1 && pulses.length < 40) spawn(p.b, p.hops - 1, p.a);
        }
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j], d = dist(a, b);
          if (d < LINK) {
            const alpha = (1 - d / LINK) * (0.14 + Math.max(a.glow, b.glow) * 0.3);
            ctx.strokeStyle = `rgba(255,170,170,${alpha.toFixed(3)})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        if (n.glow > 0.05) {
          const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 14);
          g.addColorStop(0, `rgba(255,110,110,${(n.glow * 0.55).toFixed(3)})`);
          g.addColorStop(1, 'rgba(255,110,110,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(n.x, n.y, 14, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = `rgba(255,${(215 - n.glow * 90) | 0},${(215 - n.glow * 90) | 0},${(0.5 + n.glow * 0.5).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + n.glow * 1.4, 0, Math.PI * 2); ctx.fill();
      }
      for (const p of pulses) {
        const x = p.a.x + (p.b.x - p.a.x) * p.t, y = p.a.y + (p.b.y - p.a.y) * p.t;
        const tx = p.a.x + (p.b.x - p.a.x) * Math.max(0, p.t - 0.25), ty = p.a.y + (p.b.y - p.a.y) * Math.max(0, p.t - 0.25);
        const trail = ctx.createLinearGradient(tx, ty, x, y);
        trail.addColorStop(0, 'rgba(255,120,120,0)');
        trail.addColorStop(1, 'rgba(255,200,200,.9)');
        ctx.strokeStyle = trail; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#ff6b6b'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(x, y, 1.9, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    function loop(t) {
      if (t - lastBeat > CONFIG.beatMs) { lastBeat = t; heartbeat(); }
      if (t - lastRandom > 900) { lastRandom = t; spawn(nodes[(Math.random() * nodes.length) | 0], 2); }
      step(); draw();
      raf = requestAnimationFrame(loop);
    }
    const start = () => { if (!raf && visible && !document.hidden && !reduceMotion && w) raf = requestAnimationFrame(loop); };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = null; };

    if (build()) reduceMotion ? draw() : start();

    let resizeTimer;
    new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { stop(); if (build()) reduceMotion ? draw() : start(); }, 120);
    }).observe(panel);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(panel);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  })();

  /* ================= 3. Match notification ================= */
  (function matchCard() {
    const card = $('#matchCard');
    if (!card || reduceMotion) return;
    const title = $('#matchTitle'), meta = $('#matchMeta'), type = $('#matchType');
    const items = [
      { title: 'Donor matched nearby', meta: '2.4 km away · responded just now', type: 'O−' },
      { title: 'Urgent request shared', meta: 'Nearby hospital · 6 donors notified', type: 'A+' },
      { title: 'Donor on the way', meta: 'Arriving in ~12 min · confirmed', type: 'B+' },
      { title: 'Request fulfilled', meta: '3 donors stepped up today', type: 'AB−' }
    ];
    const DUR = 4200;
    let i = 0, timer;
    card.style.setProperty('--dur', DUR + 'ms');

    const runProgress = () => { card.classList.remove('run'); void card.offsetWidth; card.classList.add('run'); };
    const next = () => {
      card.classList.add('swap');
      setTimeout(() => {
        i = (i + 1) % items.length;
        title.textContent = items[i].title;
        meta.textContent = items[i].meta;
        type.textContent = items[i].type;
        card.classList.remove('swap');
        runProgress();
      }, 360);
    };
    const play = () => { clearInterval(timer); runProgress(); timer = setInterval(next, DUR); };
    setTimeout(play, 2200); // after the card's entrance
    document.addEventListener('visibilitychange', () => (document.hidden ? clearInterval(timer) : play()));
  })();

  /* ================= 4. Form ================= */
  (function form() {
    const form = $('#loginForm');
    if (!form) return;
    const email = $('#email'), password = $('#password'), remember = $('#remember');
    const button = $('#submitButton'), label = button.querySelector('.button-label');
    const message = $('#formMessage'), toggle = $('#togglePassword'), caps = $('#capsHint');
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const STORE_KEY = 'bloodlink:remembered-email';
    let busy = false;

    const fields = {
      email: {
        input: email, error: $('#emailError'),
        value: () => email.value.trim(),
        check: (v) => !v ? 'Please enter your email address.' : !EMAIL_RE.test(v) ? 'That email doesn’t look quite right.' : ''
      },
      password: {
        input: password, error: $('#passwordError'),
        value: () => password.value,
        check: (v) => !v ? 'Please enter your password.' : v.length < 6 ? 'Password must be at least 6 characters.' : ''
      }
    };
    const touched = new Set();

    function validate(name, { show = true, shake = false } = {}) {
      const f = fields[name], err = f.check(f.value());
      const wrap = f.input.closest('.input-wrap');
      if (show) {
        f.error.textContent = err;
        wrap.classList.toggle('invalid', !!err);
        f.input.setAttribute('aria-invalid', String(!!err));
        if (err && shake && !reduceMotion) {
          wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake');
        }
      }
      if (name === 'email') wrap.classList.toggle('valid', !err);
      return !err;
    }

    Object.keys(fields).forEach((name) => {
      const input = fields[name].input;
      input.addEventListener('input', () => {
        validate(name, { show: touched.has(name) });
        if (message.textContent) { message.textContent = ''; message.className = 'form-message'; }
      });
      input.addEventListener('blur', () => {
        if (fields[name].value()) { touched.add(name); validate(name); }
      });
      input.closest('.input-wrap').addEventListener('animationend', (e) => e.currentTarget.classList.remove('shake'));
    });

    /* password visibility */
    toggle?.addEventListener('click', () => {
      const show = password.type === 'password';
      password.type = show ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(show));
      toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      password.focus({ preventScroll: true });
      const end = password.value.length;
      try { password.setSelectionRange(end, end); } catch (_) {}
    });

    /* caps lock hint */
    const capsCheck = (e) => caps?.classList.toggle('show', !!e.getModifierState?.('CapsLock'));
    password.addEventListener('keydown', capsCheck);
    password.addEventListener('keyup', capsCheck);
    password.addEventListener('blur', () => caps?.classList.remove('show'));

    /* remember me */
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) { email.value = saved; remember.checked = true; validate('email', { show: false }); }
    } catch (_) {}
    if (finePointer) (email.value ? password : email).focus({ preventScroll: true });

    /* forgot password */
    const forgot = $('#forgotLink');
    if (forgot) {
      if (CONFIG.resetUrl) forgot.href = CONFIG.resetUrl;
      else forgot.addEventListener('click', (e) => { e.preventDefault(); toast('Password reset is coming soon.'); });
    }

    /* ripple + magnetic button */
    button.addEventListener('pointerdown', (e) => {
      if (reduceMotion) return;
      const r = button.getBoundingClientRect(), dot = document.createElement('span');
      dot.className = 'ripple';
      dot.style.left = e.clientX - r.left + 'px';
      dot.style.top = e.clientY - r.top + 'px';
      button.appendChild(dot);
      dot.addEventListener('animationend', () => dot.remove());
    });
    if (finePointer && !reduceMotion) {
      button.addEventListener('pointermove', (e) => {
        const r = button.getBoundingClientRect();
        button.style.setProperty('--tx', ((e.clientX - r.left - r.width / 2) * 0.06).toFixed(1) + 'px');
        button.style.setProperty('--ty', ((e.clientY - r.top - r.height / 2) * 0.18).toFixed(1) + 'px');
      });
      button.addEventListener('pointerleave', () => { button.style.setProperty('--tx', '0px'); button.style.setProperty('--ty', '0px'); });
    }

    function setState(state) {
      button.classList.toggle('loading', state === 'loading');
      button.classList.toggle('success', state === 'success');
      button.setAttribute('aria-busy', String(state === 'loading'));
      label.textContent = state === 'loading' ? 'Signing in…' : state === 'success' ? 'Signed in' : 'Sign in';
    }

    async function signIn(payload) {
      if (!CONFIG.loginEndpoint) {
        await new Promise((r) => setTimeout(r, 1500));
        return { demo: true };
      }
      const res = await fetch(CONFIG.loginEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      let data = {};
      try { data = await res.json(); } catch (_) {}
      if (!res.ok) {
        throw new Error(data.message || (res.status === 401 ? 'Incorrect email or password.' : 'Something went wrong. Please try again.'));
      }
      return data;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      touched.add('email'); touched.add('password');
      const okEmail = validate('email', { shake: true });
      const okPass = validate('password', { shake: true });
      if (!okEmail || !okPass) { (okEmail ? password : email).focus(); return; }

      busy = true;
      message.textContent = ''; message.className = 'form-message';
      setState('loading');
      try {
        const result = await signIn({ email: email.value.trim(), password: password.value, remember: remember.checked });
        try {
          remember.checked ? localStorage.setItem(STORE_KEY, email.value.trim()) : localStorage.removeItem(STORE_KEY);
        } catch (_) {}
        setState('success');
        if (result.demo) {
          message.textContent = 'Demo mode: set loginEndpoint in login.js to sign in for real.';
          setTimeout(() => { setState('idle'); busy = false; }, 2400);
        } else {
          message.textContent = 'Welcome back! Taking you in…';
          setTimeout(() => { window.location.href = result.redirect || CONFIG.redirectTo; }, 900);
        }
      } catch (err) {
        setState('idle');
        busy = false;
        message.className = 'form-message error';
        message.textContent = err.message || 'Unable to sign in right now.';
        const wrap = password.closest('.input-wrap');
        if (!reduceMotion) { wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake'); }
        password.select();
      }
    });
  })();
})();