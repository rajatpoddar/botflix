import { useState } from 'react'

export default function FloatingInput({
  id,
  label,
  type = 'text',
  value,
  onChange,
  error,
  autoComplete,
  required = false,
}) {
  const [focused, setFocused] = useState(false)
  const raised = focused || value?.length > 0

  return (
    <div className="relative w-full">
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        required={required}
        className={`
          peer w-full rounded-md bg-zinc-800/80 border px-4 pt-6 pb-2
          text-white text-sm outline-none transition-colors
          ${error
            ? 'border-red-500 focus:border-red-400'
            : 'border-zinc-700 focus:border-violet-500'
          }
        `}
      />
      <label
        htmlFor={id}
        className={`
          pointer-events-none absolute left-4 transition-all duration-200
          ${raised
            ? 'top-2 text-xs text-zinc-400'
            : 'top-1/2 -translate-y-1/2 text-sm text-zinc-500'
          }
          ${focused && !error ? 'text-violet-400' : ''}
        `}
      >
        {label}
      </label>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}
