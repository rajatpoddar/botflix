import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { mediaAPI } from '../lib/api'
import Navbar from '../components/layout/Navbar'
import MediaCard from '../components/media/MediaCard'

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query.trim()) return
    setLoading(true)
    mediaAPI.search(query)
      .then((res) => setResults(res.data?.Items || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [query])

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <h1 className="text-2xl font-bold mb-2">
          {query ? `Results for "${query}"` : 'Search'}
        </h1>
        <p className="text-zinc-500 text-sm mb-8">
          {!loading && results.length > 0 && `${results.length} title${results.length !== 1 ? 's' : ''} found`}
        </p>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-lg bg-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {results.map((item) => (
              <MediaCard key={item.Id} item={item} />
            ))}
          </div>
        ) : query ? (
          <div className="text-center py-20 text-zinc-500">
            <p className="text-lg">No results found for "{query}"</p>
            <p className="text-sm mt-2">Try different keywords</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
