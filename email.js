const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@saudievents.local';

let transporter = null;
if (SMTP_HOST && SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT || 587,
    secure: false,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}

async function sendMail(to, subject, text, html) {
  if (!transporter) {
    console.log('EMAIL (simulated) ->', { to, subject, text });
    return { ok: true, simulated: true };
  }

  const info = await transporter.sendMail({
    from: FROM_EMAIL,
    to,
    subject,
    text,
    html
  });

  return { ok: true, info };
}

module.exports = { sendMail };
