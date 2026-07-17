import { motion } from 'framer-motion'
import { getPublicImageUrl } from '../../lib/api'

export default function PosterCollage({ items = [] }) {
  // Need at least a few items for a good collage effect
  if (items.length < 4) return null

  // Create rows of posters with staggered animation
  const rowCount = 4
  const postersPerRow = Math.ceil(items.length / rowCount)
  const rows = []
  for (let i = 0; i < rowCount; i++) {
    rows.push(items.slice(i * postersPerRow, (i + 1) * postersPerRow))
  }

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* Dark gradient overlays for edges */}
      <div className="absolute inset-0 z-[3] bg-gradient-to-r from-zinc-950/70 via-transparent to-zinc-950/70" />
      <div className="absolute inset-0 z-[3] bg-gradient-to-t from-zinc-950/60 via-zinc-950/30 to-zinc-950/50" />

      <div className="absolute inset-0 flex flex-col gap-3 sm:gap-4 opacity-60 scale-110">
        {rows.map((row, rowIdx) => (
          <motion.div
            key={rowIdx}
            className="flex gap-3 sm:gap-4"
            initial={{ x: rowIdx % 2 === 0 ? '-5%' : '5%' }}
            animate={{
              x: rowIdx % 2 === 0 ? ['-5%', '-15%', '-5%'] : ['5%', '15%', '5%'],
            }}
            transition={{
              duration: 20 + rowIdx * 3,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            {row.map((item) => (
              <div
                key={item.Id}
                className="flex-shrink-0 w-28 sm:w-36 aspect-[2/3] rounded-lg overflow-hidden shadow-lg"
              >
                <img
                  src={getPublicImageUrl(item.Id, 'Primary', 200, 80)}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
            {/* Duplicate for seamless scroll */}
            {row.map((item) => (
              <div
                key={`dup-${item.Id}`}
                className="flex-shrink-0 w-28 sm:w-36 aspect-[2/3] rounded-lg overflow-hidden shadow-lg"
              >
                <img
                  src={getPublicImageUrl(item.Id, 'Primary', 200, 80)}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
