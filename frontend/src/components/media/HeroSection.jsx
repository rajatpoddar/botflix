import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { getProxiedImageUrl } from '../../lib/api'

function getJellyfinImageUrl(itemId, type, index = null, width = 1920) {
  return getProxiedImageUrl(itemId, type, width, 85, index)
}

function truncate(str, n) {
  return str?.length > n ? str.slice(0, n - 1) + '…' : str
}

export default function HeroSection({ items = [] }) {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const featured = items.slice(0, 5)

  // Auto-rotate every 8 seconds
  useEffect(() => {
    if (featured.length <= 1) return
    const id = setInterval(() => setCurrent((c) => (c + 1) % featured.length), 8000)
    return () => clearInterval(id)
  }, [featured.length])

  if (!featured.length) {
    return <div className="h-[70vh] bg-zinc-900 animate-pulse" />
  }

  const item = featured[current]
  const backdropUrl = item.BackdropImageTags?.length
    ? getJellyfinImageUrl(item.Id, 'Backdrop', 0)
    : item.ImageTags?.Primary
    ? getJellyfinImageUrl(item.Id, 'Primary')
    : null

  return (
    <div className="relative h-[75vh] min-h-[500px] overflow-hidden">
      {/* Background */}
      <AnimatePresence mode="wait">
        <motion.div
          key={item.Id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          {backdropUrl ? (
            <img
              src={backdropUrl}
              alt={item.Name}
              className="w-full h-full object-cover object-center"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-violet-900/40 to-zinc-900" />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/30" />

      {/* Content */}
      <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-16 sm:pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={item.Id + '-text'}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
            className="max-w-xl"
          >
            {/* Genre tags */}
            <div className="flex flex-wrap gap-2 mb-3">
              {item.Genres?.slice(0, 3).map((g) => (
                <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-violet-900/60 border border-violet-700/50 text-violet-300">
                  {g}
                </span>
              ))}
            </div>

            <h1 className="text-4xl sm:text-5xl font-black text-white text-shadow mb-3 leading-tight">
              {item.Name}
            </h1>

            {item.ProductionYear && (
              <p className="text-zinc-400 text-sm mb-3">{item.ProductionYear}</p>
            )}

            {item.Overview && (
              <p className="text-zinc-300 text-sm sm:text-base leading-relaxed mb-6">
                {truncate(item.Overview, 200)}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => navigate(`/watch/${item.Id}`)}
                className="flex items-center gap-2 bg-white text-zinc-900 font-bold px-6 py-3 rounded-lg hover:bg-zinc-200 transition-colors"
              >
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Play
              </button>
              <button
                onClick={() => navigate(item.Type === 'Series' ? `/show/${item.Id}` : `/movie/${item.Id}`)}
                className="flex items-center gap-2 bg-zinc-800/80 text-white font-semibold px-6 py-3 rounded-lg hover:bg-zinc-700 transition-colors border border-zinc-700"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                More Info
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Dot indicators */}
        {featured.length > 1 && (
          <div className="flex gap-2 mt-8">
            {featured.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === current ? 'bg-white w-6' : 'bg-zinc-600 w-2'
                }`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
