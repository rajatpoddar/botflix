import { useEffect, useState } from 'react'
import { mediaAPI } from '../lib/api'
import HeroSection from '../components/media/HeroSection'
import MediaCarousel from '../components/media/MediaCarousel'
import Navbar from '../components/layout/Navbar'

export default function HomePage() {
  const [latest, setLatest] = useState([])
  const [movies, setMovies] = useState([])
  const [shows, setShows] = useState([])
  const [topRated, setTopRated] = useState([])
  const [continueWatching, setContinueWatching] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      try {
        const [latestRes, moviesRes, showsRes, topRes, cwRes] = await Promise.allSettled([
          mediaAPI.getLatest(20),
          mediaAPI.getItems({ include_item_types: 'Movie', sort_by: 'DateCreated', sort_order: 'Descending', limit: 20 }),
          mediaAPI.getItems({ include_item_types: 'Series', sort_by: 'DateCreated', sort_order: 'Descending', limit: 20 }),
          mediaAPI.getItems({ include_item_types: 'Movie,Series', sort_by: 'CommunityRating', sort_order: 'Descending', limit: 20 }),
          mediaAPI.getContinueWatching(20),
        ])

        if (latestRes.status === 'fulfilled') {
          setLatest(Array.isArray(latestRes.value.data) ? latestRes.value.data : [])
        }
        if (moviesRes.status === 'fulfilled') {
          setMovies(moviesRes.value.data?.Items || [])
        }
        if (showsRes.status === 'fulfilled') {
          setShows(showsRes.value.data?.Items || [])
        }
        if (topRes.status === 'fulfilled') {
          setTopRated(topRes.value.data?.Items || [])
        }
        if (cwRes.status === 'fulfilled') {
          const items = cwRes.value.data?.Items || []
          setContinueWatching(items)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  // Hero uses recently added; fall back to movies if latest is empty
  const heroItems = latest.length ? latest.slice(0, 5) : movies.slice(0, 5)

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />

      <HeroSection items={loading ? [] : heroItems} />

      <div className="relative -mt-8 z-10 pb-20">
        {continueWatching.length > 0 && (
          <MediaCarousel title="Continue Watching" items={continueWatching} loading={false} />
        )}
        <MediaCarousel title="Recently Added" items={latest} loading={loading} />
        <MediaCarousel title="Top Rated" items={topRated} loading={loading} />
        <MediaCarousel title="Movies" items={movies} loading={loading} />
        <MediaCarousel title="TV Shows" items={shows} loading={loading} />
      </div>
    </div>
  )
}
