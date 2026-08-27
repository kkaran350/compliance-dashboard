const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const TMP_DIR = path.join(__dirname, '..', 'uploads', 'tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });

const upload = multer({
  dest: TMP_DIR,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
      return cb(new Error('Only .xlsx, .xls or .csv files are allowed for bulk import.'));
    }
    cb(null, true);
  },
});

// Maps flexible/varied header names (as seen in real asset export sheets) to our db columns
const HEADER_MAP = {
  'asset id': 'asset_id',
  'asset type': 'asset_type',
  processor: 'processor',
  ram: 'ram',
  storage: 'storage',
  os: 'os',
  'ip address': 'ip_address',
  'ip add': 'ip_address',
  'computer name': 'computer_name',
  'user name': 'user_name',
  username: 'user_name',
  department: 'department',
  location: 'location',
  status: 'status',
  notes: 'notes',
  remarks: 'notes',
};

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// GET /api/inventory
router.get('/', requireAuth, (req, res) => {
  const { department, location, asset_type, status, q } = req.query;
  let sql = 'SELECT * FROM inventory WHERE 1=1';
  const params = [];

  if (department) {
    sql += ' AND department = ?';
    params.push(department);
  }
  if (location) {
    sql += ' AND location = ?';
    params.push(location);
  }
  if (asset_type) {
    sql += ' AND asset_type = ?';
    params.push(asset_type);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (q) {
    sql +=
      ' AND (asset_id LIKE ? OR computer_name LIKE ? OR user_name LIKE ? OR ip_address LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY id DESC';

  res.json(db.prepare(sql).all(...params));
});

// POST /api/inventory  (add single asset)
router.post('/', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.asset_id && !b.computer_name) {
    return res.status(400).json({ error: 'At least an Asset ID or Computer Name is required.' });
  }

  const info = db
    .prepare(
      `INSERT INTO inventory
       (asset_id, asset_type, processor, ram, storage, os, ip_address, computer_name, user_name, department, location, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      b.asset_id || null,
      b.asset_type || null,
      b.processor || null,
      b.ram || null,
      b.storage || null,
      b.os || null,
      b.ip_address || null,
      b.computer_name || null,
      b.user_name || null,
      b.department || null,
      b.location || null,
      b.status || 'IN USE',
      b.notes || null,
      req.user.id
    );

  res.status(201).json(db.prepare('SELECT * FROM inventory WHERE id = ?').get(info.lastInsertRowid));
});

// PUT /api/inventory/:id
router.put('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Asset not found.' });

  const b = req.body || {};
  const merged = { ...existing, ...b };

  db.prepare(
    `UPDATE inventory SET
      asset_id=?, asset_type=?, processor=?, ram=?, storage=?, os=?, ip_address=?,
      computer_name=?, user_name=?, department=?, location=?, status=?, notes=?,
      updated_at=datetime('now')
     WHERE id=?`
  ).run(
    merged.asset_id,
    merged.asset_type,
    merged.processor,
    merged.ram,
    merged.storage,
    merged.os,
    merged.ip_address,
    merged.computer_name,
    merged.user_name,
    merged.department,
    merged.location,
    merged.status,
    merged.notes,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id));
});

// DELETE /api/inventory/:id
router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT id FROM inventory WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Asset not found.' });
  db.prepare('DELETE FROM inventory WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/inventory/import  (bulk import from Excel/CSV)
router.post('/import', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const insert = db.prepare(
      `INSERT INTO inventory
       (asset_id, asset_type, processor, ram, storage, os, ip_address, computer_name, user_name, department, location, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    let imported = 0;
    const skipped = [];

    const insertMany = db.transaction((records) => {
      for (const record of records) {
        const mapped = {};
        for (const [rawKey, value] of Object.entries(record)) {
          const key = HEADER_MAP[normalizeHeader(rawKey)];
          if (key) mapped[key] = String(value ?? '').trim();
        }

        if (!mapped.asset_id && !mapped.computer_name) {
          skipped.push(record);
          continue;
        }

        insert.run(
          mapped.asset_id || null,
          mapped.asset_type || null,
          mapped.processor || null,
          mapped.ram || null,
          mapped.storage || null,
          mapped.os || null,
          mapped.ip_address || null,
          mapped.computer_name || null,
          mapped.user_name || null,
          mapped.department || null,
          mapped.location || null,
          mapped.status || 'IN USE',
          mapped.notes || null,
          req.user.id
        );
        imported++;
      }
    });

    insertMany(rows);

    fs.unlinkSync(req.file.path); // clean up temp upload

    res.json({ imported, skippedCount: skipped.length, totalRows: rows.length });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(400).json({ error: 'Could not parse file: ' + err.message });
  }
});

// GET /api/inventory/summary/stats
router.get('/summary/stats', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM inventory').all();

  const groupBy = (key) =>
    rows.reduce((acc, r) => {
      const val = r[key] || 'Unspecified';
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});

  res.json({
    total: rows.length,
    byType: groupBy('asset_type'),
    byDepartment: groupBy('department'),
    byLocation: groupBy('location'),
    byStatus: groupBy('status'),
  });
});

module.exports = router;
