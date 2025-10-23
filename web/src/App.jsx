import { useEffect, useState } from 'react'
import { listAgents, createAgent, deleteAgent, getLogs, listExecutions, runPrompt } from './api'
import Terminal from './components/Terminal'
import AgentForm from './components/AgentForm'
import Sidebar from './components/Sidebar'
import Alert from './components/Alert'

export default function App() {
  const [agents, setAgents] = useState([])
  const [selected, setSelected] = useState(null)
  const [executionId, setExecutionId] = useState(null)
  const [history, setHistory] = useState([])
  const [executions, setExecutions] = useState([])
  const [running, setRunning] = useState(false)
  const [files, setFiles] = useState([])
  const [images, setImages] = useState([])
  const [viewExecution, setViewExecution] = useState(null)
  const [executionLogs, setExecutionLogs] = useState([])
  const [error, setError] = useState('')
  const [prompt, setPrompt] = useState('')
  const [promptMode, setPromptMode] = useState('plan')
  const [promptExecutionId, setPromptExecutionId] = useState(null)
  const [promptRunning, setPromptRunning] = useState(false)
  const [promptError, setPromptError] = useState('')

  const refresh = async () => setAgents(await listAgents())
  useEffect(() => { refresh() }, [])

  useEffect(() => {
    if (!selected) return
    getLogs(selected.id).then(setHistory)
    listExecutions(selected.id).then(setExecutions)
  }, [selected])

  const handleRun = async (agent) => {
    setRunning(true)
    try {
      const res = await fetch(`/api/agents/${agent.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, images })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body?.error || 'Failed to start execution')
        setRunning(false)
        return
      }
      setError('')
      setExecutionId(body.executionId)
    } catch (e) {
      setRunning(false)
      console.error(e)
      setError('Network error starting execution')
    }
  }

  const handleKill = async () => {
    if (!executionId) return
    try {
      await fetch(`/api/executions/${executionId}/kill`, { method: 'POST' })
      setRunning(false)
      setExecutionId(null)
    } catch (e) {
      console.error(e)
    }
  }

  const viewExecutionDetail = async (execId) => {
    const logs = await fetch(`/api/executions/${execId}/logs`).then(r => r.json())
    setExecutionLogs(logs)
    setViewExecution(execId)
  }

  const handlePromptRun = async (e) => {
    e.preventDefault()
    const trimmed = prompt.trim()
    if (!trimmed) {
      setPromptError('Enter a prompt to run')
      return
    }
    setPromptError('')
    setPromptRunning(true)
    setPromptExecutionId(null)
    try {
      const body = await runPrompt({ prompt: trimmed, mode: promptMode })
      setPromptExecutionId(body.executionId)
    } catch (err) {
      console.error(err)
      setPromptError(err.message || 'Failed to run prompt')
      setPromptRunning(false)
    }
  }

  const handlePromptKill = async () => {
    if (!promptExecutionId) return
    try {
      await fetch(`/api/executions/${promptExecutionId}/kill`, { method: 'POST' })
    } catch (err) {
      console.error(err)
    } finally {
      setPromptRunning(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-slate-100 lg:flex-row">
      <Sidebar
        agents={agents}
        selectedId={selected?.id}
        onSelect={setSelected}
        onCreate={() => setSelected({})}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
          <div className="rounded-2xl border border-border bg-panel p-6 shadow-lg">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">Quick Prompt Runner</h3>
                <p className="text-sm text-muted">
                  Execute a one-off prompt directly against Cline and inspect the live output below.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePromptKill}
                disabled={!promptExecutionId || !promptRunning}
                className="inline-flex items-center justify-center rounded-full border border-danger/60 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Kill Prompt
              </button>
            </div>
            {promptError && (
              <div className="mt-4 rounded-xl border border-danger/40 bg-danger/15 px-4 py-3 text-sm text-danger">
                {promptError}
              </div>
            )}
            <form className="mt-4 space-y-4" onSubmit={handlePromptRun}>
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-white">Prompt</span>
                <textarea
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the task you want Cline to run…"
                  className="w-full rounded-2xl border border-border/60 bg-background/40 px-4 py-3 text-sm text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </label>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <label className="flex flex-1 flex-col gap-2 text-sm">
                  <span className="font-medium text-white">Mode</span>
                  <select
                    value={promptMode}
                    onChange={(e) => setPromptMode(e.target.value)}
                    className="rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm text-slate-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                  >
                    <option value="plan">Plan</option>
                    <option value="act">Act</option>
                    <option value="oneshot">Oneshot</option>
                  </select>
                </label>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2 text-sm font-semibold text-background transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={promptRunning}
                  >
                    {promptRunning ? 'Running…' : 'Run Prompt'}
                  </button>
                </div>
              </div>
            </form>
            {promptExecutionId && (
              <div className="mt-6">
                <Terminal
                  executionId={promptExecutionId}
                  onClose={() => {
                    setPromptRunning(false)
                  }}
                />
              </div>
            )}
          </div>

          <Alert title="Run failed">{error}</Alert>

          {!selected && (
            <div className="rounded-2xl border border-border bg-panel p-10 text-center text-sm text-muted shadow-lg">
              Select or create an agent to get started.
            </div>
          )}

          {selected && selected.id && (
            <div className="flex flex-col gap-6">
              <header className="flex flex-col gap-4 rounded-2xl border border-border bg-panel p-6 shadow-lg sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">{selected.name}</h3>
                  <p className="mt-1 inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                    {selected.mode || 'plan'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/api/agents/${selected.id}/logs/export`}
                    className="inline-flex items-center justify-center rounded-full border border-accent px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent hover:text-background"
                  >
                    Download Logs
                  </a>
                  <button
                    onClick={() => handleRun(selected)}
                    className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-medium text-background transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={running}
                  >
                    {running ? 'Running…' : 'Run'}
                  </button>
                  <button
                    onClick={handleKill}
                    className="inline-flex items-center justify-center rounded-full bg-danger px-4 py-2 text-sm font-medium text-white transition hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={!running}
                  >
                    Kill
                  </button>
                  <button
                    onClick={async () => { await deleteAgent(selected.id); setSelected(null); refresh(); }}
                    className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted transition hover:bg-border/40"
                  >
                    Delete
                  </button>
                </div>
              </header>

              <section className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-border bg-panel p-6 shadow-lg">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">Instruction</h4>
                  <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-border/60 bg-black/40 p-4 text-sm leading-relaxed text-slate-200">
                    {selected.instruction}
                  </pre>
                </div>
                <div className="rounded-2xl border border-border bg-panel p-6 shadow-lg">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">History</h4>
                  <div className="mt-4 max-h-60 space-y-2 overflow-y-auto rounded-xl border border-border/60 bg-black/20 p-4 text-xs leading-relaxed text-slate-300">
                    {history.length === 0 && <div className="text-muted">No logs yet.</div>}
                    {history.map(l => (
                      <div key={l.id} className={l.type === 'stderr' ? 'text-danger' : ''}>
                        [{l.type}] {l.output}
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <div className="rounded-2xl border border-border bg-panel p-6 shadow-lg">
                <div className="flex items-center justify-between gap-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">Live Terminal</h4>
                </div>
                <div className="mt-4">
                  <Terminal
                    executionId={executionId}
                    onClose={async () => {
                      setRunning(false)
                      setExecutionId(null)
                      if (selected) {
                        getLogs(selected.id).then(setHistory)
                        listExecutions(selected.id).then(setExecutions)
                      }
                    }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-panel p-6 shadow-lg">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">Executions</h4>
                  <div className="flex flex-col gap-2 text-xs text-muted md:text-sm">
                    <span>{executions.length} total</span>
                    {running && <span className="text-accent">Currently running…</span>}
                  </div>
                </div>
                <div className="mt-4 space-y-2 max-h-64 overflow-y-auto rounded-xl border border-border/60 bg-black/20 p-4 text-sm">
                  {executions.length === 0 && <div className="text-muted">No executions yet</div>}
                  {executions.map(ex => (
                    <div key={ex.id} className="flex flex-col gap-2 rounded-xl border border-border/40 bg-background/60 p-4 md:flex-row md:items-center md:justify-between">
                      <div className="text-sm text-slate-200">
                        <span className="font-semibold text-white">#{ex.id}</span>{' '}
                        <span className="text-muted">• {ex.status}</span>
                        {ex.exit_code !== null && ex.exit_code !== undefined && (
                          <span className={ex.exit_code === 0 ? 'text-success' : 'text-danger'}>
                            {' '}({`code ${ex.exit_code}`})
                          </span>
                        )}
                        <div className="mt-1 text-xs text-muted">
                          started {ex.started_at}{ex.ended_at ? ` • ended ${ex.ended_at}` : ''}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <a
                          href={`/api/executions/${ex.id}/logs/export`}
                          className="inline-flex items-center justify-center rounded-full border border-accent px-3 py-1 font-medium text-accent transition hover:bg-accent hover:text-background"
                        >
                          Download
                        </a>
                        <button
                          onClick={() => viewExecutionDetail(ex.id)}
                          className="inline-flex items-center justify-center rounded-full border border-border px-3 py-1 font-medium text-slate-200 transition hover:bg-border/40"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-panel p-6 shadow-lg">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">Attach Files / Images</h4>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <input
                    placeholder="File path"
                    onBlur={(e) => { if (e.target.value) setFiles(prev => [...prev, e.target.value]) }}
                    className="w-full rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  <input
                    placeholder="Image path"
                    onBlur={(e) => { if (e.target.value) setImages(prev => [...prev, e.target.value]) }}
                    className="w-full rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>
                {(files.length > 0 || images.length > 0) && (
                  <div className="mt-4 space-y-2 text-xs text-muted">
                    {files.length > 0 && <div>Files: {files.join(', ')}</div>}
                    {images.length > 0 && <div>Images: {images.join(', ')}</div>}
                  </div>
                )}
              </div>
            </div>
          )}

          {selected && !selected.id && (
            <div className="rounded-2xl border border-border bg-panel p-6 shadow-lg">
              <header className="mb-4">
                <h3 className="text-xl font-semibold text-white">New Agent</h3>
                <p className="text-sm text-muted">Configure instructions and defaults for your next run.</p>
              </header>
              <AgentForm
                onSave={async (payload) => { await createAgent(payload); setSelected(null); refresh(); }}
                onCancel={() => setSelected(null)}
              />
            </div>
          )}
        </div>
      </main>

      {viewExecution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl">
            <header className="flex items-center justify-between border-b border-border/70 bg-background/80 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">Execution #{viewExecution}</h3>
              <button
                onClick={() => setViewExecution(null)}
                className="rounded-full border border-border px-3 py-1 text-sm font-medium text-muted transition hover:bg-border/40"
              >
                Close
              </button>
            </header>
            <section className="max-h-[70vh] overflow-y-auto px-6 py-6">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">Logs</h4>
                <div className="max-h-[55vh] space-y-2 overflow-y-auto rounded-xl border border-border/60 bg-black/30 p-4 text-sm text-slate-200">
                  {executionLogs.map(l => (
                    <div key={l.id} className={l.type === 'stderr' ? 'text-danger' : ''}>
                      [{l.timestamp}] [{l.type}] {l.output}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
