require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./db'); // ensures schema exists on boot
const bcrypt = require('bcryptjs');

// Auto-create the first admin account on boot if no users exist yet.
// Controlled by ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_NAME env vars.
(function ensureAdmin() {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'Admin@12345';
    const name = process.env.ADMIN_NAME || 'Administrator';
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(
      'INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(name, username, hash, 'admin');
    console.log(`No users found — created admin account "${username}". Change this password after logging in.`);
  }
})();

const authRoutes = require('./routes/auth');
const complianceRoutes = require('./routes/compliance');
const inventoryRoutes = require('./routes/inventory');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/inventory', inventoryRoutes);

// Serve the built frontend (frontend/dist) as static files, so the whole app
// is reachable from a single URL / single deployed service.
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(FRONTEND_DIST));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

// generic error handler (e.g. multer file-type errors)
app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: err.message || 'Something went wrong.' });
  }
  next();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Compliance Dashboard API running on http://localhost:${PORT}`);
});
