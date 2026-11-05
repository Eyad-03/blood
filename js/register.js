/* ==========================================================
   BloodLink — Create account
   1. Smoothed pointer parallax (left panel)
   2. Living donor network (canvas) pulsing with the heartbeat
   3. Community card — rotates, and reacts to the chosen role
   4. Form: role cards with sliding highlight, animated role
      panels, blood-type picker, strength meter, live checks,
      completeness meter that fills the drop, success state
   ========================================================== */
(() => {
  'use strict';

  /* ---------- Config: connect your backend here ---------- */
  const CONFIG = {
    registerEndpoint: '',          // e.g. '/api/auth/register' — empty = demo mode
    loginUrl: '/html/login.html',  // "Continue to sign in" target
    termsUrl: '',                  // e.g. '/html/terms.html'
    privacyUrl: '',                // e.g. '/html/privacy.html'
    beatMs: 1600                   // keep in sync with --beat in register.css
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const panel = $('#visualPanel');
  const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

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
  const pointer = { x: -9999, y: -9999 };
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
    panel.addEventListener('pointerleave', () => { tx = ty = 0; pointer.x = pointer.y = -9999; kick(); });
  }

  /* ================= 2. Donor network ================= */
  const network = (function () {
    const canvas = $('#network');
    if (!canvas || !panel) return { burst() {} };
    const ctx = canvas.getContext('2d');
    const core = $('#core');
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
    function spawn(from, hops = 3, exclude) {
      if (!from) return;
      const options = nodes.filter((m) => m !== from && m !== exclude && dist(from, m) < LINK);
      if (!options.length) return;
      pulses.push({ a: from, b: options[(Math.random() * options.length) | 0], t: 0, speed: 0.016 + Math.random() * 0.012, hops });
    }
    function corePoint() {
      if (!core) return { x: w / 2, y: h / 2 };
      const pr = panel.getBoundingClientRect(), cr = core.getBoundingClientRect();
      return { x: cr.left - pr.left + cr.width / 2, y: cr.top - pr.top + cr.height / 2 };
    }
    function heartbeat(n = 3, hops = 4) {
      const c = corePoint();
      [...nodes].sort((a, b) => dist(a, c) - dist(b, c)).slice(0, n).forEach((node) => { node.glow = 1; spawn(node, hops); });
    }
    function step() {
      for (const n of nodes) {
        const dx = n.x - pointer.x, dy = n.y - pointer.y, d = Math.hypot(dx, dy);
        if (d < 110 && d > 0) { n.vx += (dx / d) * 0.03; n.vy += (dy / d) * 0.03; }
        n.vx *= 0.985; n.vy *= 0.985;
        if (Math.hypot(n.vx, n.vy) < 0.08) { n.vx += (Math.random() - 0.5) * 0.04; n.vy += (Math.random() - 0.5) * 0.04; }
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
          if (p.hops > 1 && pulses.length < 50) spawn(p.b, p.hops - 1, p.a);
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
            ctx.strokeStyle = `rgba(255,170,170,${((1 - d / LINK) * (0.14 + Math.max(a.glow, b.glow) * 0.3)).toFixed(3)})`;
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
        const c = (215 - n.glow * 90) | 0;
        ctx.fillStyle = `rgba(255,${c},${c},${(0.5 + n.glow * 0.5).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + n.glow * 1.4, 0, Math.PI * 2); ctx.fill();
      }
      for (const p of pulses) {
        const x = p.a.x + (p.b.x - p.a.x) * p.t, y = p.a.y + (p.b.y - p.a.y) * p.t;
        const k = Math.max(0, p.t - 0.25);
        const tx = p.a.x + (p.b.x - p.a.x) * k, ty = p.a.y + (p.b.y - p.a.y) * k;
        const trail = ctx.createLinearGradient(tx, ty, x, y);
        trail.addColorStop(0, 'rgba(255,120,120,0)');
        trail.addColorStop(1, 'rgba(255,200,200,.9)');
        ctx.strokeStyle = trail; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.shadowColor = '#ff6b6b'; ctx.shadowBlur = 10;
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

    // a bigger wave of signals — used on success
    return { burst: () => { if (!reduceMotion && w) heartbeat(10, 6); } };
  })();

  /* ================= 3. Community card ================= */
  const card = (function () {
    const el = $('#matchCard');
    if (!el) return { show() {} };
    const title = $('#matchTitle'), meta = $('#matchMeta'), badge = $('#matchType');
    // illustrative examples only
    const feed = [
      { title: 'A new donor joined', meta: 'Irbid · just now', badge: 'O+' },
      { title: 'Blood center verified', meta: 'Amman · a few minutes ago', badge: '✓' },
      { title: 'Request answered', meta: '2 donors responded', badge: 'A−' },
      { title: 'Community growing', meta: 'New members joined this week', badge: 'B+' }
    ];
    const DUR = 4200;
    let i = 0, timer = null, started = false;
    el.style.setProperty('--dur', DUR + 'ms');

    function set(item) {
      title.textContent = item.title;
      meta.textContent = item.meta;
      badge.textContent = item.badge;
    }
    function swapTo(item) {
      if (reduceMotion) { set(item); return; }
      el.classList.add('swap');
      setTimeout(() => { set(item); el.classList.remove('swap'); restart(el, 'run'); }, 340);
    }
    const next = () => { i = (i + 1) % feed.length; swapTo(feed[i]); };
    function play(delay = DUR) {
      clearInterval(timer); clearTimeout(timer);
      if (reduceMotion) return;
      restart(el, 'run');
      timer = setTimeout(() => { next(); timer = setInterval(next, DUR); }, delay);
    }
    setTimeout(() => { started = true; play(); }, 2200);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInterval(timer); clearTimeout(timer); } else if (started) play(); });

    // show a specific message, hold it a little longer, then resume the feed
    return {
      show(item, hold = DUR * 1.5) {
        if (!started) { set(item); return; }
        swapTo(item);
        clearInterval(timer); clearTimeout(timer);
        if (!reduceMotion) timer = setTimeout(() => play(0), hold);
      },
      stop() { clearInterval(timer); clearTimeout(timer); }
    };
  })();

  /* ================= 4. Form ================= */
  const form = $('#registerForm');
  if (!form) return;

  const els = {
    roleOptions: $('#roleOptions'),
    roleInputs: $$('input[name="role"]'),
    fullName: $('#fullName'), email: $('#email'),
    password: $('#password'), confirm: $('#confirmPassword'),
    consent: $('#consent'),
    typePicker: $('#typePicker'), typeInputs: $$('input[name="requiredBloodType"]'),
    requestCity: $('#requestCity'),
    institutionName: $('#institutionName'), institutionCity: $('#institutionCity'),
    button: $('#submitButton'), message: $('#formMessage'),
    strength: $('#strength'), strengthText: $('#strengthText'), rules: $('#passwordRules'),
    caps: $('#capsHint'),
    progressBar: $('#progressBar'), progressText: $('#progressText'),
    liquid: $('#liquid'), core: $('#core'), fillValue: $('#fillValue'),
    stage: $('#formStage'), success: $('#successView')
  };
  const panels = { requester: $('#requesterFields'), hospital: $('#hospitalFields') };
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const role = () => (els.roleInputs.find((r) => r.checked) || {}).value || '';
  const pickedType = () => (els.typeInputs.find((r) => r.checked) || {}).value || '';

  /* ---- field definitions: value check + where to show errors ---- */
  const F = {
    bloodType: {
      when: () => role() === 'requester',
      check: () => pickedType() ? '' : 'Please choose the required blood type.',
      error: $('#bloodTypeError'), wrap: () => els.typePicker, focus: () => els.typeInputs[0]
    },
    requestCity: {
      when: () => role() === 'requester',
      check: () => els.requestCity.value ? '' : 'Please choose a city for the request.',
      error: $('#requestCityError'), wrap: () => els.requestCity.closest('.select-wrap'), focus: () => els.requestCity
    },
    institutionName: {
      when: () => role() === 'hospital',
      check: () => {
        const v = els.institutionName.value.trim();
        return !v ? 'Please enter the institution name.' : v.length < 3 ? 'That name looks too short.' : '';
      },
      error: $('#institutionError'), wrap: () => els.institutionName.closest('.input-wrap'), focus: () => els.institutionName, tick: true
    },
    institutionCity: {
      when: () => role() === 'hospital',
      check: () => els.institutionCity.value ? '' : 'Please choose the institution city.',
      error: $('#institutionCityError'), wrap: () => els.institutionCity.closest('.select-wrap'), focus: () => els.institutionCity
    },
    fullName: {
      check: () => {
        const v = els.fullName.value.trim();
        return !v ? 'Please enter your full name.' : v.length < 2 ? 'Your name should be at least 2 characters.' : '';
      },
      error: $('#nameError'), wrap: () => els.fullName.closest('.input-wrap'), focus: () => els.fullName, tick: true
    },
    email: {
      check: () => {
        const v = els.email.value.trim();
        return !v ? 'Please enter your email address.' : !EMAIL_RE.test(v) ? 'That email doesn’t look quite right.' : '';
      },
      error: $('#emailError'), wrap: () => els.email.closest('.input-wrap'), focus: () => els.email, tick: true
    },
    password: {
      check: () => {
        const v = els.password.value;
        return !v ? 'Please create a password.' : v.length < 8 ? 'Use at least 8 characters.' : '';
      },
      error: $('#passwordError'), wrap: () => els.password.closest('.input-wrap'), focus: () => els.password
    },
    confirm: {
      check: () => {
        const v = els.confirm.value;
        return !v ? 'Please confirm your password.' : v !== els.password.value ? 'Passwords don’t match yet.' : '';
      },
      error: $('#confirmError'), wrap: () => els.confirm.closest('.input-wrap'), focus: () => els.confirm, tick: true
    },
    consent: {
      check: () => els.consent.checked ? '' : 'Please agree to the Terms and Privacy Policy to continue.',
      error: $('#consentError'), wrap: () => els.consent.closest('.consent-row'), focus: () => els.consent
    }
  };
  const ORDER = ['bloodType', 'requestCity', 'institutionName', 'institutionCity', 'fullName', 'email', 'password', 'confirm', 'consent'];
  const active = (k) => !F[k].when || F[k].when();
  const touched = new Set();

  function validate(key, { show = touched.has(key), shake = false } = {}) {
    const f = F[key];
    const err = active(key) ? f.check() : '';
    const wrap = f.wrap();
    if (show) {
      f.error.textContent = err;
      wrap.classList.toggle('invalid', !!err);
      const input = f.focus();
      if (input && input.type !== 'radio') input.setAttribute('aria-invalid', String(!!err));
      if (err && shake && !reduceMotion) restart(wrap, 'shake');
    }
    if (f.tick) wrap.classList.toggle('valid', !err);
    return !err;
  }
  function clearField(key) {
    const f = F[key];
    f.error.textContent = '';
    f.wrap().classList.remove('invalid', 'valid');
    touched.delete(key);
  }
  $$('.shake-target, .input-wrap, .select-wrap, .consent-row, .type-picker').forEach((el) =>
    el.addEventListener('animationend', (e) => { if (e.animationName === 'shake') el.classList.remove('shake'); }));

  /* ---- completeness: progress bar, drop fill, journey steps ---- */
  const steps = {
    role: $('[data-step="role"]'), details: $('[data-step="details"]'), secure: $('[data-step="secure"]')
  };
  let lastPct = -1;
  function updateProgress(force) {
    const keys = ORDER.filter(active);
    const ok = keys.filter((k) => F[k].check() === '').length;
    const pct = force != null ? force : Math.round(((ok + 1) / (keys.length + 1)) * 100); // +1 = role chosen
    if (pct === lastPct) return pct;
    lastPct = pct;

    els.progressBar?.style.setProperty('--p', (pct / 100).toFixed(3));
    if (els.progressText) els.progressText.textContent = pct + '%';
    if (els.fillValue) els.fillValue.textContent = pct + '%';
    if (els.liquid) els.liquid.style.transform = `translateY(${(118 - 118 * (pct / 100)).toFixed(1)}px)`;
    els.core?.classList.toggle('is-full', pct >= 100);

    const roleDone = ['bloodType', 'requestCity', 'institutionName', 'institutionCity'].filter(active).every((k) => F[k].check() === '');
    const detailsDone = ['fullName', 'email'].every((k) => F[k].check() === '');
    const secureDone = ['password', 'confirm', 'consent'].every((k) => F[k].check() === '');
    const state = [[steps.role, roleDone], [steps.details, detailsDone], [steps.secure, secureDone]];
    let activeSet = false;
    state.forEach(([el, done]) => {
      if (!el) return;
      el.classList.toggle('is-done', done);
      const isActive = !done && !activeSet;
      el.classList.toggle('is-active', isActive);
      if (isActive) activeSet = true;
    });
    els.button.classList.toggle('ready', pct >= 100 && !reduceMotion);
    return pct;
  }

  /* ---- role cards: sliding highlight + panels ---- */
  const indicator = $('.role-indicator', els.roleOptions);
  function moveIndicator(instant) {
    const sel = $('.role-option.selected', els.roleOptions);
    if (!sel || !indicator) return;
    if (instant) els.roleOptions.classList.add('no-anim');
    els.roleOptions.style.setProperty('--ix', sel.offsetLeft + 'px');
    els.roleOptions.style.setProperty('--iy', sel.offsetTop + 'px');
    els.roleOptions.style.setProperty('--iw', sel.offsetWidth + 'px');
    els.roleOptions.style.setProperty('--ih', sel.offsetHeight + 'px');
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => els.roleOptions.classList.remove('no-anim')));
  }
  new ResizeObserver(() => moveIndicator(true)).observe(els.roleOptions);

  function setPanel(el, open) {
    if (!el) return;
    el.classList.toggle('is-open', open);
    el.toggleAttribute('inert', !open);
    $$('input, select', el).forEach((c) => { c.disabled = !open; });
  }

  const ROLE_CARD = {
    donor: { title: 'Every donor counts', meta: 'Your profile helps people find a match', badge: 'Donor' },
    requester: { title: 'You’re not alone in this', meta: 'Share a request after signing in', badge: 'Need' },
    hospital: { title: 'Coordinate with your community', meta: 'Verified centers manage donations', badge: 'Center' }
  };

  function applyRole(initial) {
    const r = role();
    $$('.role-option', els.roleOptions).forEach((o) => o.classList.toggle('selected', $('input', o).checked));
    moveIndicator(initial);
    setPanel(panels.requester, r === 'requester');
    setPanel(panels.hospital, r === 'hospital');
    ['bloodType', 'requestCity', 'institutionName', 'institutionCity'].forEach((k) => { if (!active(k)) clearField(k); });
    $('#roleError').textContent = '';
    if (!initial) card.show(ROLE_CARD[r] || ROLE_CARD.donor);
    highlightType();
    updateProgress();
  }
  els.roleInputs.forEach((r) => r.addEventListener('change', () => applyRole(false)));

  /* ---- blood type picker ↔ orbiting chips ---- */
  const norm = (s) => s.replace('-', '−');
  function highlightType() {
    const t = role() === 'requester' ? pickedType() : '';
    $$('.type-chip').forEach((c) => c.classList.toggle('is-picked', !!t && c.textContent.trim() === norm(t)));
  }
  els.typeInputs.forEach((r) => r.addEventListener('change', () => {
    touched.add('bloodType'); validate('bloodType');
    highlightType();
    const t = pickedType();
    if (t && t !== 'Not sure') card.show({ title: `Looking for ${norm(t)} donors`, meta: 'Requests can be shared after signing in', badge: norm(t) });
    updateProgress();
  }));

  /* ---- selects: placeholder colour + validation ---- */
  [['requestCity', els.requestCity], ['institutionCity', els.institutionCity]].forEach(([key, sel]) => {
    const paint = () => sel.classList.toggle('is-empty', !sel.value);
    paint();
    sel.addEventListener('change', () => { paint(); touched.add(key); validate(key); updateProgress(); });
  });

  /* ---- text inputs ---- */
  [['fullName', els.fullName], ['email', els.email], ['institutionName', els.institutionName], ['confirm', els.confirm]].forEach(([key, input]) => {
    input.addEventListener('input', () => { validate(key); updateProgress(); clearMessage(); });
    input.addEventListener('blur', () => {
      if (input.value.trim()) { touched.add(key); validate(key); }
      if (key === 'fullName' && F.fullName.check() === '') {
        const first = els.fullName.value.trim().split(/\s+/)[0];
        card.show({ title: `Nice to meet you, ${first}`, meta: 'Just a few more details to go', badge: 'Hi' });
      }
    });
  });

  /* ---- password: strength + rules ---- */
  const RULES = {
    length: (v) => v.length >= 8,
    case: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v),
    number: (v) => /\d/.test(v),
    symbol: (v) => /[^A-Za-z0-9]/.test(v)
  };
  const LABELS = ['Use 8+ characters', 'Too short', 'Fair', 'Good', 'Strong'];
  function updateStrength() {
    const v = els.password.value;
    const met = Object.fromEntries(Object.entries(RULES).map(([k, fn]) => [k, fn(v)]));
    $$('li', els.rules).forEach((li) => li.classList.toggle('ok', !!met[li.dataset.rule]));
    let score = 0;
    if (v) {
      score = met.length ? 1 + ['case', 'number', 'symbol'].filter((k) => met[k]).length : 1;
      if (met.length && v.length >= 12 && score < 4) score++;
      score = Math.min(4, score);
      if (met.length && score === 1) score = 2; // 8+ chars is at least "fair"
    }
    els.strength.dataset.score = String(score);
    els.strengthText.textContent = score === 1 ? LABELS[1] : LABELS[score] || LABELS[0];
  }
  els.password.addEventListener('input', () => {
    updateStrength();
    validate('password');
    if (els.confirm.value) { touched.add('confirm'); validate('confirm'); }
    updateProgress(); clearMessage();
  });
  els.password.addEventListener('blur', () => { if (els.password.value) { touched.add('password'); validate('password'); } });

  /* caps lock hint (both password fields) */
  [els.password, els.confirm].forEach((inp) => {
    const check = (e) => els.caps?.classList.toggle('show', !!e.getModifierState?.('CapsLock'));
    inp.addEventListener('keydown', check);
    inp.addEventListener('keyup', check);
    inp.addEventListener('blur', () => els.caps?.classList.remove('show'));
  });

  /* show / hide password */
  $$('.password-toggle').forEach((btn) => btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.setAttribute('aria-pressed', String(show));
    const which = btn.dataset.target === 'password' ? 'password' : 'confirm password';
    btn.setAttribute('aria-label', (show ? 'Hide ' : 'Show ') + which);
    input.focus({ preventScroll: true });
    try { input.setSelectionRange(input.value.length, input.value.length); } catch (_) {}
  }));

  /* consent */
  els.consent.addEventListener('change', () => { touched.add('consent'); validate('consent'); updateProgress(); });

  /* terms / privacy */
  [['#termsLink', CONFIG.termsUrl, 'Terms of Service'], ['#privacyLink', CONFIG.privacyUrl, 'Privacy Policy']].forEach(([sel, url, name]) => {
    const a = $(sel);
    if (!a) return;
    if (url) { a.href = url; a.target = '_blank'; a.rel = 'noopener'; }
    else a.addEventListener('click', (e) => { e.preventDefault(); toast(`The ${name} page is coming soon.`); });
  });

  /* ripple + magnetic submit */
  const button = els.button;
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

  function clearMessage() {
    if (els.message.textContent) { els.message.textContent = ''; els.message.className = 'form-message'; }
  }
  function setLoading(on) {
    button.classList.toggle('loading', on);
    button.setAttribute('aria-busy', String(on));
    $('.button-label', button).textContent = on ? 'Creating account…' : 'Create account';
  }

  async function signUp(payload) {
    if (!CONFIG.registerEndpoint) {
      await new Promise((r) => setTimeout(r, 1600));
      return { demo: true };
    }
    const res = await fetch(CONFIG.registerEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const err = new Error(data.message || (res.status === 409 ? 'An account with this email already exists.' : 'Something went wrong. Please try again.'));
      err.field = data.field || (res.status === 409 ? 'email' : null);
      throw err;
    }
    return data;
  }

  /* ---- success ---- */
  const COLORS = ['#ef4444', '#b91c1c', '#fca5a5', '#f87171', '#16a34a', '#fecaca'];
  function burst() {
    const host = $('#burst');
    if (!host || reduceMotion) return;
    host.innerHTML = '';
    for (let i = 0; i < 22; i++) {
      const a = (Math.PI * 2 * i) / 22 + Math.random() * 0.3;
      const d = 70 + Math.random() * 70;
      const p = document.createElement('i');
      p.style.setProperty('--x', (Math.cos(a) * d).toFixed(1) + 'px');
      p.style.setProperty('--y', (Math.sin(a) * d).toFixed(1) + 'px');
      p.style.setProperty('--r', ((a * 180) / Math.PI + 90).toFixed(0) + 'deg');
      p.style.setProperty('--c', COLORS[i % COLORS.length]);
      p.style.setProperty('--dl', (0.55 + Math.random() * 0.15).toFixed(2) + 's');
      host.appendChild(p);
    }
  }
  const SUCCESS_TEXT = {
    donor: 'Thank you for choosing to help. You can complete your donor profile after signing in.',
    requester: 'You can create and submit a blood request after signing in.',
    hospital: 'Your institution will be reviewed by BloodLink administration before institutional permissions are granted.'
  };
  function showSuccess(result, r, name) {
    updateProgress(100);
    if (els.core && !reduceMotion) restart(els.core, 'splash');
    network.burst();
    card.stop();
    card.show({ title: 'Welcome to the community', meta: 'Your account is ready', badge: '✓' }, 1e9);

    const first = name.split(/\s+/)[0];
    $('#successTitle').textContent = `Welcome to BloodLink, ${first}!`;
    $('#successText').textContent = SUCCESS_TEXT[r] || SUCCESS_TEXT.donor;
    $('#successNote').textContent = result.demo ? 'Demo mode: set registerEndpoint in register.js to create real accounts.' : '';
    const cta = $('.success-cta', els.success);
    if (cta) cta.href = result.redirect || CONFIG.loginUrl;

    const reveal = () => {
      els.stage.hidden = true;
      els.success.hidden = false;
      burst();
      els.success.focus({ preventScroll: true });
      els.success.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    };
    if (reduceMotion) reveal();
    else { els.stage.classList.add('leaving'); setTimeout(reveal, 450); }
  }

  /* ---- submit ---- */
  let busy = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    clearMessage();
    let first = null;
    ORDER.filter(active).forEach((k) => {
      touched.add(k);
      if (!validate(k, { show: true, shake: true }) && !first) first = k;
    });
    if (first) {
      const target = F[first].focus();
      target?.focus({ preventScroll: true });
      F[first].wrap().scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      return;
    }

    const r = role();
    const name = els.fullName.value.trim();
    const payload = { role: r, fullName: name, email: els.email.value.trim(), password: els.password.value };
    if (r === 'requester') Object.assign(payload, { requiredBloodType: pickedType(), requestCity: els.requestCity.value });
    if (r === 'hospital') Object.assign(payload, { institutionName: els.institutionName.value.trim(), institutionCity: els.institutionCity.value });

    busy = true;
    setLoading(true);
    try {
      const result = await signUp(payload);
      setLoading(false);
      showSuccess(result, r, name);
    } catch (err) {
      setLoading(false);
      busy = false;
      if (err.field && F[err.field]) {
        const f = F[err.field];
        f.error.textContent = err.message;
        f.wrap().classList.add('invalid');
        f.wrap().classList.remove('valid');
        if (!reduceMotion) restart(f.wrap(), 'shake');
        f.focus()?.focus();
      } else {
        els.message.className = 'form-message error';
        els.message.textContent = err.message || 'Unable to create your account right now.';
      }
    }
  });

  /* ---- init ---- */
  applyRole(true);
  updateStrength();
  updateProgress();
})();


function navigateToDonor()
{
  window.location.href = "/html/donate.html"
}


function navigateToNeed()
{
  window.location.href = "/html/donorSearch.html"
}

function navigateToHospital()
{
  window.location.href = "/html/hospital.html"
}





