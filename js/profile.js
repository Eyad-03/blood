(function () {
  'use strict';

  /* ---------- helpers ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var KEYS = {
    profile: 'bloodlink_profile',
    donor: 'bloodlink_donor'
  };
  var ML_PER_DONATION = 450;
  var BAG_GOAL = 10; // donations needed to fill the bag

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }
  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* ---------- state ---------- */
  var profile = load(KEYS.profile, {
    name: 'Eyad Mansour',
    email: 'eyad@example.com',
    phone: '',
    location: 'Irbid, Jordan'
  });

  var donor = load(KEYS.donor, { available: false, donations: [] });
  if (!Array.isArray(donor.donations)) donor.donations = [];

  /* ---------- profile ---------- */
  function initials(name) {
    var parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  function renderProfile() {
    $('avatar').textContent = initials(profile.name);
    $('summaryName').textContent = profile.name;
    $('summaryLocation').textContent = profile.location;
    $('nameValue').textContent = profile.name;
    $('emailValue').textContent = profile.email;
    $('phoneValue').textContent = profile.phone || 'Add your phone number';
    $('locationValue').textContent = profile.location;

    var fields = [profile.name, profile.email, profile.phone, profile.location];
    var done = fields.filter(function (v) { return v && v.trim(); }).length;
    var pct = Math.round((done / fields.length) * 100);
    $('completionText').textContent = pct + '%';
    $('completionBar').style.width = pct + '%';
  }

  /* ---------- modals ---------- */
  function openModal(id) {
    var el = $(id);
    el.hidden = false;
    var first = el.querySelector('input,select,textarea');
    if (first) first.focus();
  }
  function closeModal(id) { $(id).hidden = true; }

  document.addEventListener('click', function (e) {
    var closer = e.target.closest('[data-close]');
    if (closer) { closeModal(closer.dataset.close); return; }
    if (e.target.classList && e.target.classList.contains('backdrop')) e.target.hidden = true;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      ['profileBackdrop'].forEach(closeModal);
    }
  });

  function openProfileModal() {
    $('editName').value = profile.name;
    $('editEmail').value = profile.email;
    $('editPhone').value = profile.phone;
    $('editLocation').value = profile.location;
    openModal('profileBackdrop');
  }
  $('editProfile').addEventListener('click', openProfileModal);
  $('editDetails').addEventListener('click', openProfileModal);

  $('profileForm').addEventListener('submit', function (e) {
    e.preventDefault();
    profile = {
      name: $('editName').value.trim(),
      email: $('editEmail').value.trim(),
      phone: $('editPhone').value.trim(),
      location: $('editLocation').value.trim()
    };
    save(KEYS.profile, profile);
    renderProfile();
    closeModal('profileBackdrop');
  });

/* ---------- donations: counter, bag, availability ---------- */
  var card = $('donorCard');
  var liquid = $('liquid');
  var bagInner = 194; // inner height of the bag in SVG units
  var msgTimer;

  function say(text) {
    var el = $('donorMsg');
    el.textContent = text;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(function () {
      el.textContent = 'Each donation is counted as ' + ML_PER_DONATION + ' ml. Demo only: stored in this browser.';
    }, 4000);
  }

  function renderDonor(animate) {
    var count = donor.donations.length;
    var level = Math.min(count, BAG_GOAL) / BAG_GOAL;

    var num = $('donationCount');
    num.textContent = count;
    if (animate) {
      num.classList.remove('bump');
      void num.offsetWidth;
      num.classList.add('bump');
    }
    $('donationBadge').textContent = count;
    $('donationVolume').textContent = (count * ML_PER_DONATION).toLocaleString('en-US') + ' ml';
    $('lastDonation').textContent = count ? fmtDate(donor.donations[count - 1]) : 'No donations yet';

    // bag volume
    var offset = (1 - level) * bagInner;
    liquid.style.transform = 'translateY(' + offset + 'px)';
    var surface = 42 + offset;
    $('drops').style.setProperty('--fall', Math.max(0, surface - 50) + 'px');
    card.classList.toggle('is-empty', count === 0);
    card.classList.toggle('is-full', level >= 1);

    var pct = Math.round(level * 100);
    $('bagPercent').textContent = pct + '%';
    $('bagBar').style.width = pct + '%';
    $('bagText').textContent = level >= 1
      ? 'Bag full – thank you for saving lives!'
      : count + ' of ' + BAG_GOAL + ' donations to fill the bag';

    $('undoDonation').disabled = count === 0;

    // availability
    var on = !!donor.available;
    card.classList.toggle('is-off', !on);
    var sw = $('availabilityToggle');
    sw.setAttribute('aria-checked', String(on));
    $('donorStatusText').textContent = on ? 'Available' : 'Unavailable';
    $('donorStatusHint').textContent = on
      ? 'Blood is flowing. You can be contacted and record donations.'
      : 'Blood flow is stopped. Switch on to become available.';
    $('addDonation').disabled = !on;
    $('addDonation').title = on ? '' : 'Switch to “Available” to record a donation';
  }

  $('availabilityToggle').addEventListener('click', function () {
    donor.available = !donor.available;
    save(KEYS.donor, donor);
    renderDonor(false);
    say(donor.available ? 'You are now available to donate.' : 'You are now unavailable. Blood flow stopped.');
  });

  $('addDonation').addEventListener('click', function () {
    if (!donor.available) { say('Switch your status to “Available” first.'); return; }
    donor.donations.push(new Date().toISOString());
    save(KEYS.donor, donor);
    renderDonor(true);
    say('Donation recorded. Thank you!');
  });

  $('undoDonation').addEventListener('click', function () {
    if (!donor.donations.length) return;
    donor.donations.pop();
    save(KEYS.donor, donor);
    renderDonor(true);
    say('Last donation removed.');
  });

  /* ---------- init ---------- */
  renderProfile();
  renderDonor(false);
})();


(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const hero = $('hero');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fineHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
 
  /* --- data (same localStorage keys as the profile page) --- */
  const load = (k, f) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch (e) { return f; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const profile = load('bloodlink_profile', {}) || {};
  const donor = Object.assign({ available: false, donations: [] }, load('bloodlink_donor', {}) || {});
  if (!Array.isArray(donor.donations)) donor.donations = [];
 
  /* --- count-up number --- */
  function countUp(el, to, dur = 900) {
    if (reduced || !to) { el.textContent = to; return; }
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
 
  /* --- render chips --- */
  function renderStatus() {
    const on = !!donor.available;
    hero.classList.toggle('donor-on', on);
    $('heroStatus').classList.toggle('on', on);
    $('heroStatus').setAttribute('aria-pressed', String(on));
    $('heroStatusText').textContent = on ? 'Available to donate' : 'Unavailable';
  }
  $('heroBlood').textContent = profile.bloodType || '—';
  countUp($('heroDonations'), donor.donations.length);
  renderStatus();
 
  // click the status chip to toggle availability
  $('heroStatus').addEventListener('click', () => {
    donor.available = !donor.available;
    save('bloodlink_donor', donor);
    renderStatus();
  });
 
  /* --- 3D tilt on the heart visual --- */
  if (fineHover && !reduced) {
    document.querySelectorAll('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }
 
  /* --- floating red blood cells behind the hero --- */
  (function cells() {
    const c = $('heroCells');
    if (!c.getContext || reduced) return;
    const ctx = c.getContext('2d');
    let w = 0, h = 0, list = [], raf = 0, mx = -1e4, my = -1e4;
    const rand = (a, b) => a + Math.random() * (b - a);
 
    function resize() {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const r = hero.getBoundingClientRect();
      w = r.width; h = r.height;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(6, Math.min(16, Math.round((w * h) / 45000)));
      list = Array.from({ length: n }, () => ({
        x: rand(0, w), y: rand(0, h), r: rand(7, 17),
        vx: rand(-.15, .15), vy: rand(-.25, -.05),
        a: rand(0, 6.28), va: rand(-.004, .004),
        ph: rand(0, 6.28), vp: rand(.004, .012), al: rand(.07, .17)
      }));
    }
    function draw(p) {
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.scale(1, .5 + .5 * Math.abs(Math.cos(p.ph)));
      ctx.globalAlpha = p.al;
      const g = ctx.createRadialGradient(0, 0, p.r * .1, 0, 0, p.r);
      g.addColorStop(0, '#f7a3b0'); g.addColorStop(.45, '#e0485f');
      g.addColorStop(.82, '#c91835'); g.addColorStop(1, '#9e0c27');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    function tick() {
      ctx.clearRect(0, 0, w, h);
      for (const p of list) {
        const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
        if (d2 < 16900) { const d = Math.sqrt(d2) || 1, f = (130 - d) / 130 * .9; p.x += dx / d * f; p.y += dy / d * f; }
        p.x += p.vx; p.y += p.vy; p.a += p.va; p.ph += p.vp;
        if (p.y < -30) { p.y = h + 30; p.x = rand(0, w); }
        if (p.x < -30) p.x = w + 30;
        if (p.x > w + 30) p.x = -30;
        draw(p);
      }
      raf = requestAnimationFrame(tick);
    }
    resize();
    let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(resize, 150); });
    hero.addEventListener('pointermove', (e) => { const r = hero.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
    hero.addEventListener('pointerleave', () => { mx = my = -1e4; });
    document.addEventListener('visibilitychange', () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(tick); });
    raf = requestAnimationFrame(tick);
  })();
})();