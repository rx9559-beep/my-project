const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
let multerLib = null;
const path = require('path');
try {
  multerLib = require('multer');
} catch (err) {
  console.warn('multer not installed; image upload endpoints will be no-ops. Install multer to enable uploads.');
}

let upload;
if (multerLib) {
  upload = multerLib({ dest: path.join(__dirname, '..', 'uploads') });
} else {
  // fallback no-op upload middleware so server runs without multer installed
  upload = {
    single: () => (req, res, next) => { next(); }
  };
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Invalid token format' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// List events
router.get('/', (req, res) => {
  (async () => {
    const db = getDb();
    await db.read();
    let events = db.data.events.map(e => {
      const org = db.data.users.find(u => u.id === e.organizerId);
      return { ...e, organizerName: org?.orgName || null };
    });
    // filter mine
    if (req.query.mine === 'true') {
      const auth = req.headers.authorization;
      if (!auth) return res.status(401).json({ error: 'No token' });
      const parts = auth.split(' ');
      if (parts.length !== 2) return res.status(401).json({ error: 'Invalid token' });
      try {
        const jwt = require('jsonwebtoken');
        const payload = jwt.verify(parts[1], JWT_SECRET);
        events = events.filter(e => e.organizerId === payload.id);
      } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }
    res.json({ ok: true, events });
  })();
});

// Get saved events for an email (public) or for auth user if token provided
router.get('/saved', async (req, res) => {
  try {
    const db = getDb(); await db.read();
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'email query required' });
    const saved = db.data.events.filter(e => (e.savedBy || []).includes(email));
    res.json({ ok: true, events: saved });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// Get liked events for an email
router.get('/liked', async (req, res) => {
  try {
    const db = getDb(); await db.read();
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'email query required' });
    const liked = db.data.events.filter(e => (e.likedBy || []).includes(email));
    res.json({ ok: true, events: liked });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// Get single event by ID
router.get('/:id', (req, res) => {
  (async () => {
    try {
      const id = Number(req.params.id);
      const db = getDb();
      await db.read();
      const event = db.data.events.find(e => e.id === id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      // Add organizer name
      const org = db.data.users.find(u => u.id === event.organizerId);
      const eventWithOrg = { ...event, organizerName: org?.orgName || null };
      
      res.json({ ok: true, event: eventWithOrg });
    } catch (error) {
      console.error('Error fetching event:', error);
      res.status(500).json({ error: 'Server error' });
    }
  })();
});

// Create event (organization only) - accepts multipart/form-data with optional image
router.post('/', authMiddleware, upload.single('image'), (req, res) => {
  try {
    if (req.user.type !== 'organization') return res.status(403).json({ error: 'Only organizations can create events' });
    const { title, category, description, location, date, price, capacity } = req.body;
    
    // Validation
    if (!title || !category || !description || !location || !date || !capacity) {
      return res.status(400).json({ error: 'Missing required fields: title, category, description, location, date, and capacity are required' });
    }
    
    (async () => {
      const db = getDb();
      await db.read();
      const id = ++db.data.lastIds.events;
      let imageUrl = null;
      if (req.file) imageUrl = `/uploads/${req.file.filename}`;
      
      const event = { 
        id, 
        title, 
        category,
        description, 
        location, 
        date, 
        price: Number(price) || 0, 
        capacity: Number(capacity) || 0, 
        organizerId: req.user.id, 
        image: imageUrl,
        savedBy: [],
        likes: 0,
        likedBy: []
      };
      
      db.data.events.push(event);
      await db.write();
      res.json({ ok: true, event });
    })();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update event (organization only, must own)
router.put('/:id', authMiddleware, upload.single('image'), (req, res) => {
  try {
    if (req.user.type !== 'organization') return res.status(403).json({ error: 'Only organizations can edit events' });
    const id = Number(req.params.id);
    (async () => {
      const db = getDb();
      await db.read();
      const ev = db.data.events.find(e => e.id === id);
      if (!ev) return res.status(404).json({ error: 'Not found' });
      if (ev.organizerId !== req.user.id) return res.status(403).json({ error: 'Not owner' });

      const { title, category, description, location, date, price, capacity, image } = req.body;
      ev.title = title;
      ev.category = category;
      ev.description = description;
      ev.location = location;
      ev.date = date;
      ev.price = Number(price) || ev.price;
      ev.capacity = Number(capacity) || ev.capacity;
      if (req.file) {
        ev.image = `/uploads/${req.file.filename}`;
      } else {
        ev.image = image || ev.image;
      }
      await db.write();
      res.json({ ok: true, event: ev });
    })();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete event
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    if (req.user.type !== 'organization') return res.status(403).json({ error: 'Only organizations can delete events' });
    const id = Number(req.params.id);
    (async () => {
      const db = getDb();
      await db.read();
      const idx = db.data.events.findIndex(e => e.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });
      if (db.data.events[idx].organizerId !== req.user.id) return res.status(403).json({ error: 'Not owner' });
      db.data.events.splice(idx, 1);
      await db.write();
      res.json({ ok: true });
    })();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Like an event
router.post('/:id/like', async (req, res) => {
  try {
    const db = getDb(); await db.read();
    const id = Number(req.params.id);
    const ev = db.data.events.find(e => e.id === id);
    if (!ev) return res.status(404).json({ error: 'Not found' });
    ev.likes = (ev.likes || 0) + 1;
    
    // Track which users liked this event
    const userEmail = req.body.email || req.query.email;
    if (userEmail) {
      ev.likedBy = ev.likedBy || [];
      if (!ev.likedBy.includes(userEmail)) {
        ev.likedBy.push(userEmail);
      }
    }
    
    await db.write();
    res.json({ ok: true, likes: ev.likes });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// Unlike an event
router.post('/:id/unlike', async (req, res) => {
  try {
    const db = getDb(); await db.read();
    const id = Number(req.params.id);
    const { email } = req.body;
    
    if (!email) return res.status(400).json({ error: 'Email required' });
    
    const ev = db.data.events.find(e => e.id === id);
    if (!ev) return res.status(404).json({ error: 'Event not found' });
    
    // Remove user from likedBy array
    ev.likedBy = (ev.likedBy || []).filter(userEmail => userEmail !== email);
    
    // Decrease likes count
    ev.likes = Math.max((ev.likes || 1) - 1, 0);
    
    await db.write();
    res.json({ ok: true, likes: ev.likes });
  } catch (e) { 
    console.error(e); 
    res.status(500).json({ error: 'Server error' }); 
  }
});

// Unsave event for authenticated user
router.delete('/:id/unsave', authMiddleware, async (req, res) => {
  try {
    const db = getDb(); await db.read();
    const id = Number(req.params.id);
    const ev = db.data.events.find(e => e.id === id);
    if (!ev) return res.status(404).json({ error: 'Not found' });
    ev.savedBy = (ev.savedBy || []).filter(email => email !== req.user.email);
    await db.write();
    res.json({ ok: true, savedBy: ev.savedBy });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// Save event for user (requires token to identify user)
router.post('/:id/save', (req, res) => {
  try {
    const auth = req.headers.authorization; if (!auth) return res.status(401).json({ error: 'No token' });
    const parts = auth.split(' '); if (parts.length !== 2) return res.status(401).json({ error: 'Invalid token' });
    const jwtLib = require('jsonwebtoken');
    let payload;
    try { payload = jwtLib.verify(parts[1], JWT_SECRET); } catch (e) { return res.status(401).json({ error: 'Invalid token' }); }
    (async () => {
      const db = getDb(); await db.read();
      const id = Number(req.params.id);
      const ev = db.data.events.find(e => e.id === id);
      if (!ev) return res.status(404).json({ error: 'Not found' });
      ev.savedBy = ev.savedBy || [];
      if (!ev.savedBy.includes(payload.email)) ev.savedBy.push(payload.email);
      await db.write();
      res.json({ ok: true, savedBy: ev.savedBy });
    })();
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
