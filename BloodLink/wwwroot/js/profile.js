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
  var CERT_GOAL = 5; // donations needed to earn the emailed certificate
  var CERT_ENDPOINT = '/api/send-certificate'; // backend route that emails the certificate

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
      ['profileBackdrop', 'certBackdrop'].forEach(closeModal);
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

    renderCert();
  }

  /* ---------- certificate: issued once at CERT_GOAL donations, emailed to the donor ---------- */
  var certBusy = false;   // an email request is in flight
  var certError = false;  // the last email attempt failed
  var certImage = null;   // JPEG data URL of the current certificate

  function newCertId() {
    return 'BL-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  }

  function ensureFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var loading = Promise.all([
      document.fonts.load('800 80px Manrope'),
      document.fonts.load('500 30px "DM Sans"')
    ]).catch(function () {});
    return Promise.race([loading, new Promise(function (r) { setTimeout(r, 1500); })]);
  }

  function drawDrop(g, cx, cy, size, white) {
    var s = size / 120;
    g.save();
    g.translate(cx - 50 * s, cy - 58 * s);
    g.scale(s, s);
    if (white) {
      g.fillStyle = '#ffffff';
    } else {
      var gr = g.createLinearGradient(12, 4, 88, 112);
      gr.addColorStop(0, '#ff4d6a'); gr.addColorStop(0.55, '#d11d3c'); gr.addColorStop(1, '#8e0b23');
      g.fillStyle = gr;
    }
    g.fill(new Path2D('M50 4C40 22 12 48 12 74a38 38 0 0 0 76 0C88 48 60 22 50 4Z'));
    g.fillStyle = white ? '#c91835' : 'rgba(255,255,255,.95)';
    g.fill(new Path2D('M50 96C36 86 30 78 30 69a10 10 0 0 1 20-5a10 10 0 0 1 20 5c0 9-6 17-20 27Z'));
    g.restore();
  }

  function drawCertificate(cert) {
    var W = 1600, H = 1130;
    var SANS = '"DM Sans", "Segoe UI", Tahoma, Arial, sans-serif';
    var HEAD = 'Manrope, "DM Sans", "Segoe UI", Arial, sans-serif';
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');

    function text(str, x, y, font, color, spacing) {
      g.font = font; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      if ('letterSpacing' in g) g.letterSpacing = (spacing || 0) + 'px';
      g.fillText(str, x, y);
      if ('letterSpacing' in g) g.letterSpacing = '0px';
    }

    // background + faint blood cells
    var bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#fffdfd'); bg.addColorStop(1, '#fff0f3');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    [[150, 180, 70], [1440, 1000, 60], [1390, 160, 46], [150, 1000, 50]].forEach(function (p) {
      var rg = g.createRadialGradient(p[0], p[1], p[2] * 0.1, p[0], p[1], p[2]);
      rg.addColorStop(0, '#f7a3b0'); rg.addColorStop(1, '#c91835');
      g.globalAlpha = 0.08; g.fillStyle = rg;
      g.beginPath(); g.arc(p[0], p[1], p[2], 0, Math.PI * 2); g.fill();
    });
    g.globalAlpha = 1;

    // double frame with corner dots
    g.lineWidth = 12; g.strokeStyle = '#c91835'; g.strokeRect(46, 46, W - 92, H - 92);
    g.lineWidth = 2; g.strokeStyle = '#e9a3ae'; g.strokeRect(74, 74, W - 148, H - 148);
    [[74, 74], [W - 74, 74], [74, H - 74], [W - 74, H - 74]].forEach(function (p) {
      g.fillStyle = '#fffafb'; g.beginPath(); g.arc(p[0], p[1], 15, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c91835'; g.beginPath(); g.arc(p[0], p[1], 9, 0, Math.PI * 2); g.fill();
    });

    // header
    drawDrop(g, W / 2, 185, 120, false);
    text('BLOODLINK', W / 2, 292, '800 30px ' + HEAD, '#c91835', 10);
    text('Certificate of Appreciation', W / 2, 388, '800 80px ' + HEAD, '#22212b', -1);
    g.direction = 'rtl';
    text('شهادة شكر وتقدير', W / 2, 448, '600 38px ' + SANS, '#8e0b23', 0);
    g.direction = 'ltr';

    // recipient
    text('This certificate is proudly presented to', W / 2, 528, '500 28px ' + SANS, '#83838f', 0);
    var size = 104;
    g.font = '800 ' + size + 'px ' + HEAD;
    while (size > 44 && g.measureText(cert.name).width > 1120) {
      size -= 4;
      g.font = '800 ' + size + 'px ' + HEAD;
    }
    text(cert.name, W / 2, 628, '800 ' + size + 'px ' + HEAD, '#c91835', -1);
    g.strokeStyle = '#e9a3ae'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(W / 2 - 420, 660); g.lineTo(W / 2 + 420, 660); g.stroke();

    // reason
    var ml = (cert.donations * ML_PER_DONATION).toLocaleString('en-US');
    text('in recognition of completing ' + cert.donations + ' blood donations — ' + ml + ' ml of generosity.',
      W / 2, 728, '500 31px ' + SANS, '#4d4d5a', 0);
    text('Every drop you give is a second chance for someone else.', W / 2, 778, '500 27px ' + SANS, '#83838f', 0);

    // seal
    var sg = g.createRadialGradient(W / 2 - 20, 885, 10, W / 2, 905, 90);
    sg.addColorStop(0, '#ef5a73'); sg.addColorStop(1, '#a30c28');
    g.fillStyle = sg; g.beginPath(); g.arc(W / 2, 905, 86, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 4;
    g.beginPath(); g.arc(W / 2, 905, 73, 0, Math.PI * 2); g.stroke();
    drawDrop(g, W / 2, 905, 86, true);

    // date + signature
    function signature(x, value, label, font) {
      text(value, x, 916, font, '#22212b', 0);
      g.strokeStyle = '#c9a1ab'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x - 150, 934); g.lineTo(x + 150, 934); g.stroke();
      text(label, x, 972, '600 22px ' + SANS, '#9999a3', 2);
    }
    signature(330, cert.date, 'DATE', '600 34px ' + SANS);
    signature(W - 330, 'BloodLink Team', 'AUTHORIZED BY', 'italic 700 40px Georgia, "Times New Roman", serif');

    text('Certificate ID: ' + cert.id, W / 2, 1030, '500 20px ' + SANS, '#9999a3', 1);
    return c;
  }

  function buildCertificate(cert) {
    return ensureFonts().then(function () {
      certImage = drawCertificate({
        name: cert.name,
        donations: cert.donations,
        id: cert.id,
        date: fmtDate(cert.issuedAt)
      }).toDataURL('image/jpeg', 0.92);
    });
  }

  function withCertificate(fn) {
    var cert = donor.certificate;
    if (!cert) return Promise.resolve();
    return (certImage ? Promise.resolve() : buildCertificate(cert)).then(fn);
  }

  function certHintText() {
    var count = donor.donations.length, cert = donor.certificate;
    if (certBusy) return 'Sending your certificate to ' + profile.email + '…';
    if (cert && cert.sentAt) return 'Certificate emailed to ' + cert.sentTo + ' on ' + fmtDate(cert.sentAt) + '.';
    if (cert && certError) return 'We could not email the certificate. Download it, or try sending it again.';
    if (cert) return 'Your certificate is ready. It has not been emailed yet.';
    if (count >= CERT_GOAL) return 'You have reached ' + CERT_GOAL + ' donations. Get your certificate by email.';
    var left = CERT_GOAL - count;
    return count + ' of ' + CERT_GOAL + ' donations. ' + left + ' more and we will email you a certificate.';
  }

  function renderCert() {
    var count = donor.donations.length, cert = donor.certificate;
    var hint = certHintText();
    $('certCard').classList.toggle('is-earned', !!cert);
    $('certTitle').textContent = cert ? 'Certificate of appreciation earned' : 'Certificate of appreciation';
    $('certHint').textContent = hint;
    $('certModalStatus').textContent = hint;
    $('certBar').style.width = (cert ? 100 : Math.round(Math.min(count, CERT_GOAL) / CERT_GOAL * 100)) + '%';
    $('certOpen').hidden = !cert;
    $('certGet').hidden = !!cert || count < CERT_GOAL;
    $('certSend').textContent = cert && cert.sentAt ? 'Email it again' : 'Email me the certificate';
    $('certSend').disabled = certBusy;
    $('certGet').disabled = certBusy;
  }

  function showCertificate() {
    return withCertificate(function () {
      $('certPreview').src = certImage;
      openModal('certBackdrop');
    });
  }

  function sendCertificate() {
    var cert = donor.certificate;
    if (!cert || certBusy) return Promise.resolve();
    certBusy = true; certError = false; renderCert();
    return withCertificate(function () {
      return fetch(CERT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profile.email,
          name: cert.name,
          donations: cert.donations,
          certificateId: cert.id,
          issuedAt: cert.issuedAt,
          image: certImage
        })
      });
    }).then(function (res) {
      if (!res || !res.ok) throw new Error('send failed');
      cert.sentAt = new Date().toISOString();
      cert.sentTo = profile.email;
      save(KEYS.donor, donor);
    }).catch(function () {
      certError = true;
    }).then(function () {
      certBusy = false;
      renderCert();
    });
  }

  function issueCertificate() {
    if (donor.certificate) return Promise.resolve();
    donor.certificate = {
      id: newCertId(),
      issuedAt: new Date().toISOString(),
      donations: donor.donations.length,
      name: profile.name,
      sentAt: null,
      sentTo: null
    };
    save(KEYS.donor, donor);
    renderCert();
    return showCertificate().then(sendCertificate);
  }

  $('certOpen').addEventListener('click', showCertificate);
  $('certGet').addEventListener('click', issueCertificate);
  $('certSend').addEventListener('click', sendCertificate);
  $('certDownload').addEventListener('click', function () {
    withCertificate(function () {
      var a = document.createElement('a');
      a.href = certImage;
      a.download = 'BloodLink-Certificate-' + donor.certificate.id + '.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  });

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
    if (!donor.certificate && donor.donations.length >= CERT_GOAL) {
      say('Donation recorded. You earned a certificate!');
      issueCertificate();
    } else {
      say('Donation recorded. Thank you!');
    }
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