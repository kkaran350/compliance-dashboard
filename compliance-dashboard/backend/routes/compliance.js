const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'compliance');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});

const ALLOWED_EXT = ['.pdf', '.xlsx', '.xls', '.doc', '.docx', '.csv'];
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return cb(new Error('Only PDF, Excel (.xlsx/.xls/.csv) or Word files are allowed.'));
    }
    cb(null, true);
  },
});

function recomputeStatus(row) {
  // Auto-flag overdue items whose due date has passed and aren't completed.
  if (row.status === 'Completed') return row.status;
  if (row.due_date) {
    const today = new Date().toISOString().slice(0, 10);
    if (row.due_date < today) return 'Overdue';
  }
  return row.status;
}

// GET /api/compliance  (list, with optional filters)
router.get('/', requireAuth, (req, res) => {
  const { status, category, q } = req.query;
  let sql = 'SELECT * FROM compliances WHERE 1=1';
  const params = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (q) {
    sql += ' AND (title LIKE ? OR description LIKE ? OR reference_no LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY (due_date IS NULL), due_date ASC, id DESC';

  const rows = db.prepare(sql).all(...params);
  const withComputedStatus = rows.map((r) => ({ ...r, status: recomputeStatus(r) }));
  res.json(withComputedStatus);
});

// GET /api/compliance/:id
router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM compliances WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Compliance not found.' });
  res.json({ ...row, status: recomputeStatus(row) });
});

// POST /api/compliance  (create, optional file attachment)
router.post('/', requireAuth, upload.single('file'), (req, res) => {
  const { title, category, reference_no, description, frequency, due_date, status, notes } =
    req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required.' });
  }

  const file_name = req.file ? req.file.originalname : null;
  const file_path = req.file ? path.join('compliance', req.file.filename) : null;

  const info = db
    .prepare(
      `INSERT INTO compliances
       (title, category, reference_no, description, frequency, due_date, status, notes, file_name, file_path, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      category || null,
      reference_no || null,
      description || null,
      frequency || 'One-time',
      due_date || null,
      status || 'Pending',
      notes || null,
      file_name,
      file_path,
      req.user.id
    );

  const created = db.prepare('SELECT * FROM compliances WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);
});

// PUT /api/compliance/:id  (update fields, optionally replace file)
router.put('/:id', requireAuth, upload.single('file'), (req, res) => {
  const existing = db.prepare('SELECT * FROM compliances WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Compliance not found.' });

  const {
    title = existing.title,
    category = existing.category,
    reference_no = existing.reference_no,
    description = existing.description,
    frequency = existing.frequency,
    due_date = existing.due_date,
    status = existing.status,
    notes = existing.notes,
    completed_date = existing.completed_date,
  } = req.body;

  let file_name = existing.file_name;
  let file_path = existing.file_path;

  if (req.file) {
    // remove old file if present
    if (existing.file_path) {
      const oldFull = path.join(__dirname, '..', 'uploads', existing.file_path);
      fs.existsSync(oldFull) && fs.unlinkSync(oldFull);
    }
    file_name = req.file.originalname;
    file_path = path.join('compliance', req.file.filename);
  }

  db.prepare(
    `UPDATE compliances SET
      title = ?, category = ?, reference_no = ?, description = ?, frequency = ?,
      due_date = ?, status = ?, notes = ?, completed_date = ?, file_name = ?, file_path = ?,
      updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    title,
    category,
    reference_no,
    description,
    frequency,
    due_date,
    status,
    notes,
    completed_date,
    file_name,
    file_path,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM compliances WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/compliance/:id
router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM compliances WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Compliance not found.' });

  if (existing.file_path) {
    const fullPath = path.join(__dirname, '..', 'uploads', existing.file_path);
    fs.existsSync(fullPath) && fs.unlinkSync(fullPath);
  }
  db.prepare('DELETE FROM compliances WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/compliance/:id/file  (download attachment)
router.get('/:id/file', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM compliances WHERE id = ?').get(req.params.id);
  if (!row || !row.file_path) return res.status(404).json({ error: 'No file attached.' });

  const fullPath = path.join(__dirname, '..', 'uploads', row.file_path);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File missing on disk.' });

  res.download(fullPath, row.file_name || path.basename(fullPath));
});

// GET /api/compliance/summary/stats  (dashboard numbers)
router.get('/summary/stats', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM compliances').all();
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  let pending = 0,
    completed = 0,
    overdue = 0,
    dueSoon = 0;

  rows.forEach((r) => {
    const status = recomputeStatus(r);
    if (status === 'Completed') completed++;
    else if (status === 'Overdue') overdue++;
    else pending++;

    if (r.due_date && r.due_date >= today && r.due_date <= in7 && status !== 'Completed') {
      dueSoon++;
    }
  });

  const byCategory = {};
  rows.forEach((r) => {
    const cat = r.category || 'Uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  });

  res.json({
    total: rows.length,
    pending,
    completed,
    overdue,
    dueSoon,
    byCategory,
  });
});

module.exports = router;
