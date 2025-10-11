const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { sendMail } = require('../utils/email');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const LOCKOUT_SECONDS = 60; // temporary lock duration after 3 failed attempts

// Register (user or organization)
router.post('/register', async (req, res) => {
  try {
    const { email, password, type, orgName } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

    const db = getDb();
    await db.read();
    const existing = db.data.users.find(u => u.email === email);
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const id = ++db.data.lastIds.users;
    const user = { id, email, passwordHash, type: type || 'user', orgName: orgName || null, failedAttempts: 0, lockUntil: 0 };
    db.data.users.push(user);
    await db.write();
    res.json({ ok: true, user: { id: user.id, email: user.email, type: user.type, orgName: user.orgName } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

  const db = getDb();
  await db.read();
  const user = db.data.users.find(u => u.email === email);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const now = Math.floor(Date.now() / 1000);
    if (user.lockUntil && user.lockUntil > now) {
      return res.status(429).json({ error: 'Account temporarily locked. Try again later.' , lockUntil: user.lockUntil});
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const failed = (user.failedAttempts || 0) + 1;
      const updates = { failedAttempts: failed };
      if (failed >= 3) {
        updates.lockUntil = now + LOCKOUT_SECONDS;
        // send email to attempted address
        try {
          await sendMail(email, 'Multiple failed login attempts', `There were ${failed} failed login attempts to your account. If this wasn't you, please contact support.`, null);
        } catch (e) {
          console.error('Email error', e);
        }
      }
      const idx = db.data.users.findIndex(u => u.id === user.id);
      if (idx >= 0) {
        db.data.users[idx].failedAttempts = updates.failedAttempts || 0;
        db.data.users[idx].lockUntil = updates.lockUntil || 0;
        await db.write();
      }

      return res.status(400).json({ error: 'Invalid credentials', attempts: failed });
    }

    // success
    const idx2 = db.data.users.findIndex(u => u.id === user.id);
    if (idx2 >= 0) {
      db.data.users[idx2].failedAttempts = 0;
      db.data.users[idx2].lockUntil = 0;
      await db.write();
    }
    const payload = { id: user.id, email: user.email, type: user.type, orgName: user.orgName };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

    res.json({ ok: true, token, user: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
