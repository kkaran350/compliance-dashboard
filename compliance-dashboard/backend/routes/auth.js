const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, username: user.username, role: user.role },
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/users  (admin only - create a teammate account)
router.post('/users', requireAuth, requireAdmin, (req, res) => {
  const { name, username, password, role } = req.body || {};
  if (!name || !username || !password) {
    return res.status(400).json({ error: 'name, username and password are required.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'That username is already taken.' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, username, hash, role === 'admin' ? 'admin' : 'user');

  res.status(201).json({ id: info.lastInsertRowid, name, username, role: role || 'user' });
});

// GET /api/auth/users (admin only - list teammates)
router.get('/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, name, username, role, created_at FROM users').all();
  res.json(users);
});

module.exports = router;
