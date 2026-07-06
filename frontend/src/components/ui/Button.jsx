export default function Button({
  children,
  type = 'button',
  onClick,
  loading = false,
  variant = 'primary',
  className = '',
  disabled = false,
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:pointer-events-none'

  const variants = {
    primary:
      'bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white focus:ring-violet-500 px-6 py-3 text-sm',
    secondary:
      'bg-zinc-800 hover:bg-zinc-700 text-white focus:ring-zinc-600 px-6 py-3 text-sm',
    ghost:
      'bg-transparent hover:bg-white/10 text-white px-4 py-2 text-sm',
    danger:
      'bg-red-600 hover:bg-red-500 text-white focus:ring-red-500 px-6 py-3 text-sm',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
