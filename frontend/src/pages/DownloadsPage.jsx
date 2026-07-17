import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from '../components/layout/Navbar'
import { useDownloads } from '../contexts/DownloadContext'

function formatRuntime(ticks) {
  if (!ticks) return null
  const minutes = Math.floor(ticks / 600000000)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function DownloadsPage() {
  const navigate = useNavigate()
  const { downloads, cancelDownload, retryDownload, clearCompleted } = useDownloads()

  const downloadingItems = downloads.filter((d) => d.status === 'downloading' || d.status === 'pending')
  const completedItems = downloads.filter((d) => d.status === 'completed')
  const failedItems = downloads.filter((d) => d.status === 'error' || d.status === 'cancelled')

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      {/* Header */}
      <div className="pt-24 pb-6 bg-gradient-to-b from-violet-950/30 to-transparent">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold">Downloads</h1>
                <p className="text-sm text-zinc-500">
                  {downloadingItems.length > 0
                    ? `${downloadingItems.length} downloading`
                    : completedItems.length > 0
                      ? `${completedItems.length} downloaded`
                      : 'No downloads yet'}
                </p>
              </div>
            </div>
            {completedItems.length > 0 && (
              <button
                onClick={clearCompleted}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-20 space-y-8">
        {/* ── Currently Downloading ── */}
        {downloadingItems.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">
              Downloading
            </h2>
            <div className="space-y-3">
              {downloadingItems.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4"
                >
                  {/* Poster */}
                  <div className="w-16 h-24 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                    {item.posterUrl ? (
                      <img src={item.posterUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">{item.name}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {[item.year, formatRuntime(item.runtime)].filter(Boolean).join(' · ')}
                    </p>
                    {/* Progress bar */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.progress}%` }}
                          transition={{ duration: 0.3, ease: 'easeOut' }}
                          className="h-full rounded-full bg-violet-500"
                        />
                      </div>
                      <span className="text-xs text-zinc-500 w-10 text-right tabular-nums">
                        {item.progress}%
                      </span>
                    </div>
                  </div>

                  {/* Cancel */}
                  <button
                    onClick={() => cancelDownload(item.id)}
                    className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-red-400"
                    aria-label="Cancel download"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── Completed ── */}
        {completedItems.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">
              Downloaded
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {completedItems.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="flex items-center gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 hover:border-zinc-700 transition-colors group"
                >
                  {/* Poster */}
                  <div className="w-14 h-20 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                    {item.posterUrl ? (
                      <img src={item.posterUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">{item.name}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {[item.year, formatRuntime(item.runtime)].filter(Boolean).join(' · ')}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">
                        Saved
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => navigate(`/watch/${item.id}`)}
                      className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
                      aria-label="Play"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => cancelDownload(item.id)}
                      className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-red-400"
                      aria-label="Remove download"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── Failed ── */}
        {failedItems.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">
              Failed
            </h2>
            <div className="space-y-3">
              {failedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4"
                >
                  <div className="w-12 h-16 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                    {item.posterUrl ? (
                      <img src={item.posterUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium truncate">{item.name}</h3>
                    <p className="text-xs text-red-400 mt-1">Download failed</p>
                  </div>
                  <button
                    onClick={() => retryDownload(item.id)}
                    className="px-3 py-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg transition-colors"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => cancelDownload(item.id)}
                    className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-red-400"
                    aria-label="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Empty State ── */}
        {downloads.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">No downloads yet</h3>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto">
              Download movies and shows to watch them offline, anytime.
            </p>
            <button
              onClick={() => navigate('/browse/movies')}
              className="mt-6 inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-3 rounded-xl transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              Browse Movies
            </button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
