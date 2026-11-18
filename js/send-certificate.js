// Express router that emails the BloodLink certificate of appreciation.
//
//   const express = require('express');
//   const app = express();
//   app.use('/api', require('./send-certificate')());   // -> POST /api/send-certificate
//
// SMTP settings come from environment variables (see fromEnv below).

const express = require('express');
const nodemailer = require('nodemailer');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CERT_ID_RE = /^BL-[A-Z0-9]{4,24}$/;
const JPEG_PREFIX = 'data:image/jpeg;base64,';
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_PER_HOUR = 3; // per email address and per IP

function fromEnv() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for port 465
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function emailHtml(name, donations) {
  return `<!doctype html>
<html><body style="margin:0;background:#faf9fb;font-family:Arial,Helvetica,sans-serif;color:#262530">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #eeebf0;border-radius:14px;overflow:hidden">
      <tr><td style="background:#c91835;padding:18px 24px;color:#fff;font-size:20px;font-weight:bold">BloodLink</td></tr>
      <tr><td style="padding:26px 24px 8px">
        <h1 style="margin:0 0 12px;font-size:22px">Congratulations, ${escapeHtml(name)}!</h1>
        <p style="margin:0 0 12px;line-height:1.6;color:#555663">
          You have completed <b>${Number(donations)} blood donations</b> with BloodLink.
          Thank you for being someone's second chance &mdash; your certificate of appreciation is attached.
        </p>
        <p dir="rtl" style="margin:0 0 18px;line-height:1.8;color:#555663">
          مبروك ${escapeHtml(name)}! أتممت ${Number(donations)} تبرعات بالدم عبر BloodLink. شكراً لك، وشهادة الشكر والتقدير مرفقة مع هذه الرسالة.
        </p>
        <img src="cid:certificate" alt="Certificate of appreciation" width="552" style="display:block;width:100%;height:auto;border:1px solid #f0e5e9;border-radius:8px">
      </td></tr>
      <tr><td style="padding:18px 24px 26px;font-size:12px;color:#9999a3">Every second can save a life. &mdash; The BloodLink team</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

module.exports = function certificateRouter(transporter = fromEnv(), options = {}) {
  const from = options.from || process.env.MAIL_FROM || 'BloodLink <no-reply@bloodlink.example>';
  const hits = new Map(); // key -> timestamps within the last hour

  function tooMany(key) {
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < 3600e3);
    recent.push(now);
    hits.set(key, recent);
    return recent.length > MAX_PER_HOUR;
  }

  const router = express.Router();

  router.post('/send-certificate', express.json({ limit: '6mb' }), async (req, res) => {
    const { email, name, donations, certificateId, image } = req.body || {};

    if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254) {
      return res.status(400).json({ error: 'invalid_email' });
    }
    if (typeof name !== 'string' || !name.trim() || name.length > 80) {
      return res.status(400).json({ error: 'invalid_name' });
    }
    if (!Number.isInteger(donations) || donations < 1 || donations > 1000) {
      return res.status(400).json({ error: 'invalid_donations' });
    }
    if (typeof certificateId !== 'string' || !CERT_ID_RE.test(certificateId)) {
      return res.status(400).json({ error: 'invalid_certificate_id' });
    }
    if (typeof image !== 'string' || !image.startsWith(JPEG_PREFIX)) {
      return res.status(400).json({ error: 'invalid_image' });
    }
    const jpg = Buffer.from(image.slice(JPEG_PREFIX.length), 'base64');
    if (jpg.length > MAX_IMAGE_BYTES || !jpg.subarray(0, 3).equals(JPEG_MAGIC)) {
      return res.status(400).json({ error: 'invalid_image' });
    }

    if (tooMany('email:' + email.toLowerCase()) || tooMany('ip:' + req.ip)) {
      return res.status(429).json({ error: 'too_many_requests' });
    }

    try {
      await transporter.sendMail({
        from,
        to: email,
        subject: 'Your BloodLink certificate of appreciation 🩸 | شهادة شكر وتقدير',
        text: `Congratulations ${name}! You have completed ${donations} blood donations with BloodLink. ` +
          'Your certificate of appreciation is attached.\n\n' +
          `مبروك ${name}! أتممت ${donations} تبرعات بالدم عبر BloodLink. شهادتك مرفقة.`,
        html: emailHtml(name, donations),
        attachments: [{
          filename: `BloodLink-Certificate-${certificateId}.jpg`,
          content: jpg,
          contentType: 'image/jpeg',
          cid: 'certificate'
        }]
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('send-certificate failed:', err.message);
      res.status(502).json({ error: 'send_failed' });
    }
  });

  return router;
};