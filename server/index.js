import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db, initDb } from './db.js';
import { startExecution, attachClient, killExecution, sendInput } from './processManager.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

initDb();

// Agents CRUD
app.get('/api/agents', (req, res) => {
  db.all('SELECT * FROM agents ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/agents', (req, res) => {
  const { name, description, instruction, mode } = req.body || {};
  if (!name || !instruction) return res.status(400).json({ error: 'name and instruction are required' });
  db.run(
    'INSERT INTO agents(name, description, instruction, mode) VALUES (?,?,?,?)',
    [name, description || '', instruction, mode || 'plan'],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM agents WHERE id = ?', [this.lastID], (e, row) => {
        if (e) return res.status(500).json({ error: e.message });
        res.status(201).json(row);
      });
    }
  );
});

app.put('/api/agents/:id', (req, res) => {
  const id = req.params.id;
  const { name, description, instruction, mode } = req.body || {};
  db.run(
    'UPDATE agents SET name = ?, description = ?, instruction = ?, mode = ? WHERE id = ?',
    [name, description, instruction, mode || 'plan', id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM agents WHERE id = ?', [id], (e, row) => {
        if (e) return res.status(500).json({ error: e.message });
        res.json(row);
      });
    }
  );
});

app.delete('/api/agents/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM agents WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

// Logs
app.get('/api/agents/:id/logs', (req, res) => {
  const id = req.params.id;
  db.all('SELECT * FROM logs WHERE agent_id = ? ORDER BY id ASC', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Run agent
app.post('/api/agents/:id/run', (req, res) => {
  const id = req.params.id;
  const { files, images } = req.body || {}; // optional file/image paths from frontend
  db.get('SELECT * FROM agents WHERE id = ?', [id], (err, agent) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    Promise.resolve()
      .then(() => startExecution(agent.id, agent.instruction, { mode: agent.mode, files, images }))
      .then(({ executionId, pid, executionDbId }) => res.json({ executionId, pid, executionDbId }))
      .catch((e) => res.status(500).json({ error: e.message || 'Failed to start execution' }));
  });
});

// Run ad-hoc prompt (non-persistent)
app.post('/api/run', (req, res) => {
  const { prompt, mode, files, images } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  Promise.resolve()
    .then(() => startExecution(null, prompt, { mode: mode || 'plan', files, images, persist: false }))
    .then(({ executionId, pid }) => res.status(201).json({ executionId, pid }))
    .catch((e) => res.status(500).json({ error: e.message || 'Failed to run prompt' }));
});

// Kill execution
app.post('/api/executions/:executionId/kill', (req, res) => {
  const ok = killExecution(req.params.executionId);
  res.json({ ok });
});

// Send input to running execution (chat-like)
app.post('/api/executions/:executionId/input', (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== 'string' || text.length === 0) {
    return res.status(400).json({ error: 'text is required' });
  }
  const ok = sendInput(req.params.executionId, text);
  if (!ok) return res.status(404).json({ error: 'execution not found' });
  res.json({ ok: true });
});

// SSE stream
app.get('/api/stream/:executionId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const ok = attachClient(req.params.executionId, res);
  if (!ok) {
    res.write('event: error\n');
    res.write('data: {"error":"execution not found"}\n\n');
    return res.end();
  }
});

// List executions for an agent
app.get('/api/agents/:id/executions', (req, res) => {
  db.all('SELECT * FROM executions WHERE agent_id = ? ORDER BY started_at DESC, id DESC', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get single execution detail
app.get('/api/executions/:executionId', (req, res) => {
  db.get('SELECT * FROM executions WHERE id = ?', [req.params.executionId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Execution not found' });
    res.json(row);
  });
});

// Get logs for a specific execution
app.get('/api/executions/:executionId/logs', (req, res) => {
  db.all('SELECT * FROM logs WHERE execution_id = ? ORDER BY id ASC', [req.params.executionId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Export logs for an agent
app.get('/api/agents/:id/logs/export', (req, res) => {
  db.all('SELECT * FROM logs WHERE agent_id = ? ORDER BY id ASC', [req.params.id], (err, rows) => {
    if (err) return res.status(500).send('Error exporting logs');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="agent-${req.params.id}-logs.txt"`);
    const lines = rows.map(r => `[${r.timestamp}] (${r.type}) ${r.output}`);
    res.send(lines.join('\n'));
  });
});

// Export logs for a specific execution
app.get('/api/executions/:executionId/logs/export', (req, res) => {
  db.all('SELECT * FROM logs WHERE execution_id = ? ORDER BY id ASC', [req.params.executionId], (err, rows) => {
    if (err) return res.status(500).send('Error exporting logs');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="execution-${req.params.executionId}-logs.txt"`);
    const lines = rows.map(r => `[${r.timestamp}] (${r.type}) ${r.output}`);
    res.send(lines.join('\n'));
  });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
