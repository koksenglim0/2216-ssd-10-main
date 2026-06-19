export default function StatusMessage({ type = 'info', children }) {
  if (!children) return null

  const styles = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  }

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${styles[type] || styles.info}`} role={type === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
