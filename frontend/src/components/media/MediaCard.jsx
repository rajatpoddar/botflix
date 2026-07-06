import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const JELLYFIN_BASE = import.meta.env.VITE_JELLYFIN_URL || ''

function formatRuntime(ticks) {
  if (!ticks) return null
  const minutes = Math.floor(ticks / 600000000)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function MediaCard({ item }) {
  const navigate = useNavigate()
  const [imgError, setImgError] = useState(false)

  const imgUrl = !imgError && item.ImageTags?.Primary
    ? `${JELLYFIN_BASE}/Items/${item.Id}/Images/Primary?width=300&quality=90`
    : null

  const runtime = formatRuntime(item.RunTimeTicks)
  const year = item.ProductionYear

  return (
    <motion.div
      whileHover={{ scale: 1.05, zIndex: 10 }}
      transition={{ duration: 0.2 }}
      className="relative flex-shrink-0 w-40 sm:w-44 cursor-pointer group"
      onClick={() => navigate(`/watch/${item.Id}`)}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-zinc-800">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={item.Name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-800">
            <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileHover={{ opacity: 1, scale: 1 }}
            className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            <svg className="w-5 h-5 text-zinc-900 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </motion.div>
        </div>

        {/* Rating badge */}
        {item.CommunityRating && (
          <div className="absolute top-2 right-2 bg-black/70 rounded px-1.5 py-0.5 text-xs font-medium flex items-center gap-1">
            <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {item.CommunityRating.toFixed(1)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-2 px-1">
        <p className="text-sm font-medium text-white truncate">{item.Name}</p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {[year, runtime].filter(Boolean).join(' · ')}
        </p>
      </div>
    </motion.div>
  )
}
