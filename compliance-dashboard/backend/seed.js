require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const username = process.env.ADMIN_USERNAME || 'admin';
const password = process.env.ADMIN_PASSWORD || 'Admin@12345';
const name = process.env.ADMIN_NAME || 'Administrator';

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

if (existing) {
  console.log(`User "${username}" already exists. Nothing to do.`);
} else {
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    'INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(name, username, hash, 'admin');
  console.log(`Created admin user:
  username: ${username}
  password: ${password}
Change this password after first login.`);
}
