export default function Sidebar({ agents, selectedId, onSelect, onCreate }) {
  return (
    <aside className="w-full border-b border-border bg-panel/90 px-4 py-6 shadow-lg backdrop-blur lg:w-72 lg:border-b-0 lg:border-r lg:px-6 lg:py-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">Agents</h2>
        <button
          className="inline-flex items-center justify-center rounded-full bg-accent px-3 py-1 text-xs font-medium text-background transition hover:bg-accent/90"
          onClick={onCreate}
        >
          + New
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Tap an agent to view instructions, history, and live output.
      </p>
      <ul className="mt-6 space-y-3">
        {agents.map((a) => {
          const active = selectedId === a.id
          return (
            <li
              key={a.id}
              className={`cursor-pointer rounded-2xl border border-transparent bg-background/70 p-4 transition hover:border-accent/60 hover:shadow-lg ${active ? 'border-accent/80 shadow-lg ring-1 ring-accent/40' : ''}`}
              onClick={() => onSelect(a)}
            >
              <div className="text-sm font-semibold text-white">{a.name}</div>
              {a.description && (
                <div className="mt-1 text-xs text-muted">
                  {a.description}
                </div>
              )}
              {a.mode && (
                <span className="mt-3 inline-flex rounded-full bg-accent/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-accent">
                  {a.mode}
                </span>
              )}
            </li>
          )
        })}
        {agents.length === 0 && (
          <li className="rounded-2xl border border-border/60 bg-background/40 p-4 text-sm text-muted">
            No agents yet. Create one to begin.
          </li>
        )}
      </ul>
    </aside>
  )
}
