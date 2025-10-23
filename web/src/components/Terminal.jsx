import { useEffect, useRef, useState } from 'react'
import { sendExecutionInput } from '../api'

export default function Terminal({ executionId, onClose }){
  const [lines, setLines] = useState([])
  const [text, setText] = useState('')
  const [connected, setConnected] = useState(false)
  const [streamError, setStreamError] = useState('')
  const ref = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    // reset buffer when starting a new execution
    setLines([])
    setConnected(false)
    setStreamError('')
    if (!executionId) return
    const es = new EventSource(`/api/stream/${executionId}`)
    es.onopen = () => setConnected(true)
    const push = (type, text) => setLines(prev => [...prev, { type, text }])
    es.addEventListener('stdout', (e) => {
      try { const { text } = JSON.parse(e.data); push('stdout', text) } catch {}
    })
    es.addEventListener('stderr', (e) => {
      try { const { text } = JSON.parse(e.data); push('stderr', text) } catch {}
    })
    es.addEventListener('close', () => { es.close(); onClose?.() })
    es.addEventListener('error', () => { setStreamError('Stream disconnected'); es.close() })
    return () => es.close()
  }, [executionId])

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [lines])

  const onSend = async (e) => {
    e.preventDefault()
    if (!executionId || !text.trim()) return
    await sendExecutionInput(executionId, text)
    setText('')
    inputRef.current?.focus()
  }

  return (
    <div className="space-y-3">
      <div
        ref={ref}
        className="h-[22rem] overflow-y-auto rounded-2xl border border-border/70 bg-black/70 p-4 font-mono text-sm text-slate-200 shadow-inner"
      >
        {lines.length === 0 && (
          <div className="mb-3 flex gap-4 text-xs text-muted">
            <span className="inline-flex h-6 min-w-[3.5rem] items-center justify-center rounded-full border border-accent/40 bg-accent/20 px-2 font-semibold text-accent">
              INFO
            </span>
            <span>{executionId ? (connected ? 'Waiting for output…' : 'Connecting…') : 'Start a run to chat.'}</span>
          </div>
        )}
        {lines.map((l, i) => (
          <div key={i} className="mb-3 flex gap-4">
            <span
              className={`inline-flex h-6 min-w-[3.5rem] items-center justify-center rounded-full border px-2 text-xs font-semibold ${
                l.type === 'stderr'
                  ? 'border-danger/50 bg-danger/20 text-danger'
                  : 'border-accent/40 bg-accent/20 text-accent'
              }`}
            >
              {l.type === 'stderr' ? 'ERR' : 'OUT'}
            </span>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100">{l.text}</pre>
          </div>
        ))}
      </div>

      {streamError && (
        <div className="rounded-xl border border-danger/40 bg-danger/15 px-4 py-3 text-xs font-medium text-danger">
          {streamError}
        </div>
      )}

      <form
        className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/60 p-4 shadow-lg sm:flex-row sm:items-center"
        onSubmit={onSend}
      >
        <label className="flex w-full flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-muted sm:flex-1">
          Message
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={executionId ? 'Type and press Enter…' : 'Start a run to chat'}
            disabled={!executionId}
            className="w-full rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <button
          type="submit"
          disabled={!executionId || !text.trim()}
          className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-background transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </div>
  )
}
