export default function Alert({ title, children }) {
  if (!children) return null
  return (
    <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-danger shadow-lg">
      {title && <div className="text-sm font-semibold uppercase tracking-wide">{title}</div>}
      <div className="mt-2 text-sm text-danger/90">{children}</div>
    </div>
  )
}
