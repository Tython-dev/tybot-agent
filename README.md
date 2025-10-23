# tybot-agent

Full-stack system to create and manage personal AI agents powered by Cline CLI, with a React dashboard, live terminal streaming via SSE, and local SQLite persistence.

## Structure

- `server/` Express API, SQLite init, Cline process execution, SSE streaming
- `web/` React (Vite) dashboard and terminal UI

## Prerequisites

- Node.js 20+
- Cline CLI available on PATH or specify `CLINE_CMD` in env

## Server Setup

1) Copy env and adjust as needed

```bash
cp server/.env.example server/.env
```

2) Install and run

```bash
npm install --prefix server
npm run dev --prefix server
```

The server starts on `http://localhost:4000`.

Env variables in `server/.env`:

- `PORT` API port (default 4000)
- `CLINE_CMD` command to execute (default `cline`)
- `CLINE_CWD` working directory for executions (optional)

## Web Setup

```bash
npm install --prefix web
npm run dev --prefix web
```

The app runs at `http://localhost:5173` with `/api` proxied to the server.

## API Overview

### Agents
- `GET /api/agents` list agents
- `POST /api/agents` create `{ name, description?, instruction, mode? }`
- `PUT /api/agents/:id` update agent
- `DELETE /api/agents/:id` delete agent
- `GET /api/agents/:id/logs` list logs
- `GET /api/agents/:id/executions` list execution history
- `GET /api/agents/:id/logs/export` download all logs as text

### Executions
- `POST /api/agents/:id/run` start execution with optional `{ files?, images? }` -> `{ executionId, pid, executionDbId }`
- `GET /api/executions/:executionId` get execution detail
- `GET /api/executions/:executionId/logs` get logs for specific execution
- `GET /api/executions/:executionId/logs/export` download execution logs
- `POST /api/executions/:executionId/kill` graceful stop
- `POST /api/executions/:executionId/input` send chat message `{ text }`

### Streaming
- `GET /api/stream/:executionId` SSE stream (events: `stdout`, `stderr`, `close`)

## Features

### Mode Presets
- Each agent has a `mode` field: `plan` (default), `act`, or `oneshot`
- Act adds `--mode act`, Oneshot adds `--oneshot` (Plan uses defaults)
- Set when creating/editing agents in the UI

### Execution Tracking
- Every run is recorded in the `executions` table with:
  - `agent_id`, `pid`, `status`, `exit_code`, `started_at`, `ended_at`
- All logs are linked to their execution via `execution_id`
- View execution history per agent
- Click "View" to see per-execution detail modal with full logs

### Interactive Chat
- Live terminal streams stdout/stderr via Server-Sent Events
- Chat input sends messages to running process stdin
- Auto-scrolls to latest output
- Terminal resets on new run

### File & Image Attachments
- Attach files via `-f` flag and images via `-i` flag
- UI provides input fields for file/image paths
- Paths are sent to backend and passed to Cline CLI

### Kill/Stop
- "Kill" button appears when execution is running
- Sends `SIGTERM` to the process
- Updates UI state immediately

### Export Logs
- Download all logs for an agent
- Download logs for a specific execution
- Plain text format with timestamps

## Notes

- All stdout/stderr lines are persisted to SQLite in `server/data.sqlite`
- Instructions are passed as the first CLI argument to Cline
- Stdin is kept open for interactive chat
- Adjust `CLINE_CMD` and `CLINE_EXTRA_ARGS` in `.env` for your setup

## License

MIT
