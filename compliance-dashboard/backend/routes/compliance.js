const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'compliance');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const IMPORT_TMP_DIR = path.join(__dirname, '..', 'uploads', 'tmp');
fs.mkdirSync(IMPORT_TMP_DIR, { recursive: true });
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
// POST /api/compliance  (create, optional file attachment)
router.post('/', requireAuth, upload.single('file'), (req, res) => {
  const { title, exchange, category, reference_no, description, frequency, due_date, status, notes } =
    req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required.' });
  }

  const file_name = req.file ? req.file.originalname : null;
  const file_path = req.file ? path.join('compliance', req.file.filename) : null;

  const info = db
    .prepare(
      `INSERT INTO compliances
       (title, exchange, category, reference_no, description, frequency, due_date, status, notes, file_name, file_path, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      exchange || null,
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
    exchange = existing.exchange,
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
      title = ?, exchange = ?, category = ?, reference_no = ?, description = ?, frequency = ?,
      due_date = ?, status = ?, notes = ?, completed_date = ?, file_name = ?, file_path = ?,
      updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    title,
    exchange,
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

// ---------- Bulk import from a compliance tracker Excel file ----------
// Built to tolerate messy real-world sheets: a title row before the header,
// varying header wording, multiple sheets (one per exchange), and a free-text
// "Periodicity / Due Date" column that mixes frequency and an actual date.

const importUpload = multer({
  dest: IMPORT_TMP_DIR,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
      return cb(new Error('Only .xlsx, .xls or .csv files are allowed for bulk import.'));
    }
    cb(null, true);
  },
});

// normalized header text -> our field name
const COMPLIANCE_HEADER_MAP = {
  'exchange': 'exchange',
  'category / department': 'category',
  'category/department': 'category',
  'category': 'category',
  'department': 'category',
  'compliance requirement': 'title',
  'requirement': 'title',
  'periodicity / due date': 'periodicity_raw',
  'periodicity/due date': 'periodicity_raw',
  'periodicity': 'periodicity_raw',
  'due date': 'periodicity_raw',
  'timeline / specific action': 'description',
  'time line / action': 'description',
  'timeline / action': 'description',
  'timeline': 'description',
  'circular reference': 'reference_no',
  'reference no': 'reference_no',
  'reference': 'reference_no',
};

const FREQUENCY_KEYWORDS = [
  ['half-yearly', 'Half-Yearly'],
  ['half yearly', 'Half-Yearly'],
  ['quarterly', 'Quarterly'],
  ['monthly', 'Monthly'],
  ['weekly', 'Weekly'],
  ['daily', 'Daily'],
  ['yearly', 'Annual'],
  ['annually', 'Annual'],
  ['annual', 'Annual'],
  ['continuous', 'Continuous'],
  ['event-based', 'Event-based'],
  ['event based', 'Event-based'],
  ['incident-based', 'Incident-based'],
  ['incident based', 'Incident-based'],
  ['prior approval', 'Prior Approval'],
];

const MONTHS = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Pulls a usable YYYY-MM-DD out of free text like "Half-yearly (15-Apr-2026)"
// or a raw Excel date string/object, if one is present.
function extractDate(value) {
  if (!value) return null;

  if (value instanceof Date && !isNaN(value)) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();

  // Already ISO-ish: 2026-04-30 or 2026-04-30 00:00:00
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // DD-Mon-YYYY (e.g. 15-Apr-2026)
  const dmy = text.match(/(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{4})/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const mon = MONTHS[dmy[2].slice(0, 3).toLowerCase()];
    if (mon) return `${dmy[3]}-${mon}-${day}`;
  }

  return null;
}

function extractFrequency(value) {
  if (!value) return 'One-time';
  const text = String(value).toLowerCase();
  for (const [needle, label] of FREQUENCY_KEYWORDS) {
    if (text.includes(needle)) return label;
  }
  return 'One-time';
}

// Scans the first ~15 rows of a sheet for the header row (the row containing
// the most recognizable column names), rather than assuming row 1.
function findHeaderRowIndex(rows) {
  let bestIdx = -1;
  let bestScore = 0;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i] || [];
    const score = row.filter((cell) => COMPLIANCE_HEADER_MAP[normalizeHeader(cell)]).length;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestScore >= 2 ? bestIdx : -1; // need at least 2 recognizable columns
}

// POST /api/compliance/import  (bulk import from an Excel/CSV tracker file)
router.post('/import', requireAuth, importUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  try {
    const workbook = XLSX.readFile(req.file.path, { cellDates: true });

    const insert = db.prepare(
      `INSERT INTO compliances
       (title, exchange, category, reference_no, description, frequency, due_date, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    let imported = 0;
    let skipped = 0;
    const sheetSummaries = [];

    const insertMany = db.transaction((sheetRows, defaultExchange) => {
      for (const row of sheetRows) {
        if (!row.title) {
          skipped++;
          continue;
        }
        const due_date = extractDate(row.periodicity_raw);
        const frequency = extractFrequency(row.periodicity_raw);
        const notes = row.periodicity_raw ? `Original schedule text: ${row.periodicity_raw}` : null;

        insert.run(
          row.title,
          row.exchange || defaultExchange || null,
          row.category || null,
          row.reference_no || null,
          row.description || null,
          frequency,
          due_date,
          'Pending',
          notes,
          req.user.id
        );
        imported++;
      }
    });

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows2D = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

      const headerIdx = findHeaderRowIndex(rows2D);
      if (headerIdx === -1) {
        sheetSummaries.push({ sheet: sheetName, imported: 0, note: 'No recognizable header row found — skipped.' });
        continue;
      }

      const headerRow = rows2D[headerIdx];
      const colMap = {}; // column index -> field name
      headerRow.forEach((cell, idx) => {
        const field = COMPLIANCE_HEADER_MAP[normalizeHeader(cell)];
        if (field) colMap[idx] = field;
      });

      const dataRows = rows2D.slice(headerIdx + 1);
      const mappedRows = dataRows
        .map((r) => {
          const record = {};
          Object.entries(colMap).forEach(([idx, field]) => {
            const val = r[idx];
            if (val !== undefined && val !== '') record[field] = String(val).trim();
          });
          return record;
        })
        .filter((r) => r.title); // drop blank trailing rows

      const before = imported;
      insertMany(mappedRows, sheetName);
      sheetSummaries.push({ sheet: sheetName, imported: imported - before });
    }

    fs.unlinkSync(req.file.path);

    res.json({ imported, skippedCount: skipped, sheets: sheetSummaries });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(400).json({ error: 'Could not parse file: ' + err.message });
  }
});

module.exports = router;
