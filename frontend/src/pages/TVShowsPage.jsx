import { useEffect, useState } from 'react'
import { mediaAPI } from '../lib/api'
import HeroSection from '../components/media/HeroSection'
import MediaCarousel from '../components/media/MediaCarousel'
import MediaGrid from '../components/media/MediaGrid'
import Navbar from '../components/layout/Navbar'

const SORT_OPTIONS = [
  { label: 'Recently Added', value: 'DateCreated' },
  { label: 'Top Rated', value: 'CommunityRating' },
  { label: 'Title A–Z', value: 'SortName' },
  { label: 'Release Year', value: 'ProductionYear' },
]

export default function TVShowsPage() {
  const [libraries, setLibraries] = useState([])
  const [libraryItems, setLibraryItems] = useState({})
  const [hero, setHero] = useState([])
  const [loading, setLoading] = useState(true)

  const [activeLib, setActiveLib] = useState('all')
  const [sortBy, setSortBy] = useState('DateCreated')
  const [gridItems, setGridItems] = useState([])
  const [gridLoading, setGridLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const PAGE_SIZE = 24

  useEffect(() => {
    async function init() {
      try {
        const libRes = await mediaAPI.getLibraries()
        // Only show TV-type libraries (tvshows) — fall back to all if none found
        let libs = (libRes.data || []).filter(
          (l) => l.CollectionType?.toLowerCase() === 'tvshows'
        )
        if (!libs.length) libs = libRes.data || []
        setLibraries(libs)

        const results = await Promise.allSettled(
          libs.map((lib) =>
            mediaAPI.getItems({
              include_item_types: 'Series',
              parent_id: lib.Id,
              sort_by: 'DateCreated',
              sort_order: 'Descending',
              limit: 20,
            })
          )
        )

        const map = {}
        let heroPool = []
        results.forEach((res, i) => {
          if (res.status === 'fulfilled') {
            const items = res.value.data?.Items || []
            map[libs[i].Id] = items
            if (heroPool.length < 5) heroPool = heroPool.concat(items.slice(0, 5 - heroPool.length))
          }
        })

        setLibraryItems(map)
        setHero(heroPool.slice(0, 5))
      } catch (e) {
        console.error('Failed to load TV libraries', e)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  useEffect(() => {
    async function fetchGrid() {
      setGridLoading(true)
      try {
        const params = {
          include_item_types: 'Series',
          sort_by: sortBy,
          sort_order: sortBy === 'SortName' ? 'Ascending' : 'Descending',
          limit: PAGE_SIZE,
          start_index: page * PAGE_SIZE,
        }
        if (activeLib !== 'all') params.parent_id = activeLib

        const res = await mediaAPI.getItems(params)
        const items = res.data?.Items || []
        const total = res.data?.TotalRecordCount || 0
        setGridItems((prev) => (page === 0 ? items : [...prev, ...items]))
        setHasMore((page + 1) * PAGE_SIZE < total)
      } finally {
        setGridLoading(false)
      }
    }
    fetchGrid()
  }, [activeLib, sortBy, page])

  function handleLibFilter(libId) {
    setActiveLib(libId)
    setSortBy('DateCreated')
    setPage(0)
    setGridItems([])
  }

  function handleSortChange(val) {
    setSortBy(val)
    setPage(0)
    setGridItems([])
  }

  const activeLibName = activeLib === 'all'
    ? 'All TV Shows'
    : libraries.find((l) => l.Id === activeLib)?.Name || 'TV Shows'

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />

      <HeroSection items={loading ? [] : hero} />

      <div className="relative -mt-8 z-10 pb-20">

        {loading
          ? <MediaCarousel title="Loading…" items={[]} loading={true} />
          : libraries.map((lib) => (
              <MediaCarousel
                key={lib.Id}
                title={lib.Name}
                items={libraryItems[lib.Id] || []}
                loading={false}
              />
            ))
        }

        <section className="px-4 sm:px-6 lg:px-8 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold mr-1">{activeLibName}</h2>
              <button
                onClick={() => handleLibFilter('all')}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  activeLib === 'all'
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
                }`}
              >
                All
              </button>
              {libraries.map((lib) => (
                <button
                  key={lib.Id}
                  onClick={() => handleLibFilter(lib.Id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    activeLib === lib.Id
                      ? 'bg-violet-600 border-violet-600 text-white'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
                  }`}
                >
                  {lib.Name}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSortChange(opt.value)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    sortBy === opt.value
                      ? 'bg-zinc-700 border-zinc-600 text-white'
                      : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <MediaGrid items={gridItems} loading={gridLoading && page === 0} />

          {hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={gridLoading}
                className="px-6 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {gridLoading ? 'Loading…' : 'Load More'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
