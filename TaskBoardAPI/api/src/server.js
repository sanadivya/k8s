const express = require('express');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;

// All config comes from environment variables (12-factor app).
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'taskboard',
  max: 10,
});

const log = (msg, extra = {}) =>
  console.log(JSON.stringify({ time: new Date().toISOString(), msg, ...extra }));

const app = express();
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () =>
    log('request', { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start })
  );
  next();
});

// Liveness: "is the process alive?" (does NOT check DB)
app.get('/healthz', (req, res) => res.json({ status: 'ok', pod: process.env.HOSTNAME }));

// Readiness: "can I serve traffic?" (checks DB)
app.get('/readyz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'db unavailable' });
  }
});

app.get('/tasks', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tasks ORDER BY id');
  res.json(rows);
});

app.post('/tasks', async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const { rows } = await pool.query(
    'INSERT INTO tasks (title) VALUES ($1) RETURNING *', [title]
  );
  res.status(201).json(rows[0]);
});

app.put('/tasks/:id', async (req, res) => {
  const { title, done } = req.body;
  const { rows } = await pool.query(
    'UPDATE tasks SET title = COALESCE($1, title), done = COALESCE($2, done) WHERE id = $3 RETURNING *',
    [title, done, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

app.delete('/tasks/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

// Basic error handler so a DB error doesn't crash the process
app.use((err, req, res, next) => {
  log('error', { error: err.message });
  res.status(500).json({ error: 'internal error' });
});

// Retry DB connection on startup: the DB may not be ready yet.
async function initDb(retries = 10) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          done BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT now()
        )`);
      log('database ready');
      return;
    } catch (err) {
      log('db not ready, retrying', { attempt: i, error: err.message });
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  log('could not connect to db, exiting');
  process.exit(1);
}

let server;
initDb().then(() => {
  server = app.listen(PORT, () => log('server started', { port: PORT }));
});

// Graceful shutdown: k8s sends SIGTERM before killing a pod.
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});