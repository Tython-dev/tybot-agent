import { useState } from 'react'

export default function AgentForm({ onSave, onCancel, initial }) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [instruction, setInstruction] = useState(initial?.instruction || '')
  const [mode, setMode] = useState(initial?.mode || 'plan')

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ name, description, instruction, mode })
      }}
    >
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-white">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-white">Description</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-white">Mode</span>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm text-slate-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="plan">Plan</option>
          <option value="act">Act</option>
          <option value="oneshot">Oneshot</option>
        </select>
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-white">Instruction</span>
        <textarea
          rows={10}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          required
          className="rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm leading-relaxed text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2 text-sm font-semibold text-background transition hover:bg-accent/90"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-semibold text-muted transition hover:bg-border/40"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
