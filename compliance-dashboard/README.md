# Compliance & Inventory Dashboard

A full-stack web app for tracking MCX (and other) compliance items alongside your IT asset
inventory. Built with:

- **Backend:** Node.js, Express, SQLite (via `better-sqlite3`), JWT auth, Multer file uploads
- **Frontend:** React (Vite), Tailwind CSS, Recharts

## Features

- **Login / multi-user** — JWT-based auth. Admins can create teammate accounts.
- **Compliance tracker** — add compliances manually or by uploading a **PDF or Excel** file as
  the supporting document. Track category, reference number, due date, frequency (one-time,
  monthly, quarterly, etc.), and status (Pending / In Progress / Completed / Overdue — overdue
  is calculated automatically once the due date passes).
- **Inventory tracker** — matches the columns from your asset export: Asset ID, Asset Type,
  Processor, RAM, Storage, OS, IP Address, Computer Name, User Name, Department, Location,
  Status. Add assets one at a time, or **bulk-import an entire Excel/CSV sheet** in one click.
- **Dashboard** — live counts (overdue, due soon, completed) and charts (compliance by category,
  inventory by department).

A copy of the sample inventory sheet you shared is included at
`sample-inventory-import.xlsx` — use it to test the bulk import feature.

## Project structure

```
compliance-dashboard/
├── backend/          Express API + SQLite database
│   ├── server.js
│   ├── db.js
│   ├── seed.js       creates the first admin user
│   ├── routes/
│   └── uploads/       uploaded compliance files are stored here
└── frontend/         React app (Vite)
    └── src/
```

## 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env      # edit JWT_SECRET and the default admin password
npm run seed               # creates the first admin login
npm run dev                 # starts the API on http://localhost:4000
```

The `.env` file controls the admin account created by `npm run seed`:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@12345
```

**Change the password after your first login** — either directly in SQLite, or by adding a
"change password" endpoint (not included by default to keep the scope focused).

The SQLite database file is created automatically at `backend/data/dashboard.db` — no external
database server required.

## 2. Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually **http://localhost:5173**). The Vite dev server proxies
`/api` requests to the backend on port 4000, so both need to be running.

Log in with the admin username/password you set in `backend/.env`.

## 3. Try the bulk inventory import

1. Go to **Inventory**.
2. Click **Bulk Upload (Excel/CSV)**.
3. Select `sample-inventory-import.xlsx` (in the project root) or your own sheet.

The importer matches these header names (case-insensitive) automatically: `Asset ID`,
`Asset Type`, `Processor`, `RAM`, `Storage`, `OS`, `IP Address`, `Computer Name`, `User Name`,
`Department`, `Location`, `Status`, `Notes`/`Remarks`. Extra columns in your sheet are ignored;
rows missing both an Asset ID and Computer Name are skipped and reported back to you.

## 4. Adding compliances

Go to **Compliances → + Add / Upload Compliance**. Fill in the title, category, due date, etc.,
and optionally attach the source **PDF or Excel** file (e.g. the MCX circular itself). The file
can be downloaded again later from the compliance table.

## 5. Deploying — getting a live link anyone can use

The backend now serves the built frontend directly, so the **whole app deploys as one single
service with one URL**. No separate frontend host needed, no CORS config, nothing to keep in
sync.

**Recommended: Railway** (has persistent storage, which Vercel does not — this app needs that
for the SQLite database and uploaded compliance files).

1. Push this project to a GitHub repo (or use the Railway CLI to deploy straight from your
   folder — `railway up`, no GitHub required).
2. In Railway, create a new project from that repo. It will detect the root `package.json` and
   run `npm install` (which builds the frontend automatically via `postinstall`), then
   `npm start`.
3. Add a **Volume** in Railway and mount it at `/app/backend/data` (for the SQLite database)
   — and ideally a second one at `/app/backend/uploads` (for uploaded compliance files) —
   so your data survives restarts and redeploys.
4. Set these environment variables in Railway's dashboard:
   - `JWT_SECRET` — any long random string
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_NAME` — your first login (auto-created on
     first boot if no users exist yet — no manual seed step needed in production)
5. Deploy. Railway gives you a live `https://yourapp.up.railway.app` URL — that's the link you
   share with anyone who needs access.

Render works the same way (Web Service + persistent disk instead of a volume).

**Why not Vercel:** Vercel runs backends as serverless functions with no persistent disk —
every file written (the SQLite database, uploaded PDFs/Excel files) gets wiped between
requests. That's a structural limitation, not something fixable with settings. If you want
everything on Vercel specifically, the backend would need to be rewritten to use a hosted
database (e.g. Postgres via Neon/Supabase) and cloud file storage (e.g. Cloudflare R2 or AWS
S3) instead of SQLite and local disk — happy to do that rework if you'd prefer that route.

## Notes & things you may want to extend

- Passwords are stored as bcrypt hashes; there's no "forgot password" flow yet.
- File uploads are capped at 20MB and restricted to PDF/Excel/Word/CSV.
- The "Overdue" status is computed on read (based on today's date vs. due date) rather than
  stored, so it's always accurate without needing a background job.
- Everything one logged-in user can do, any other logged-in user can also do (no per-department
  permissions yet) — let me know if you want role-based restrictions later.
