import { useEffect, useState } from 'react'
import { mediaAPI } from '../lib/api'
import HeroSection from '../components/media/HeroSection'
import MediaCarousel from '../components/media/MediaCarousel'
import Navbar from '../components/layout/Navbar'

export default function HomePage() {
  const [latest, setLatest] = useState([])
  const [movies, setMovies] = useState([])
  const [trending, setTrending] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      try {
        const [latestRes, moviesRes, trendingRes] = await Promise.allSettled([
          mediaAPI.getLatest(20),
          mediaAPI.getItems({ include_item_types: 'Movie', sort_by: 'DateCreated', limit: 20 }),
          mediaAPI.getItems({ include_item_types: 'Movie', sort_by: 'CommunityRating', limit: 20 }),
        ])

        if (latestRes.status === 'fulfilled') {
          setLatest(Array.isArray(latestRes.value.data) ? latestRes.value.data : [])
        }
        if (moviesRes.status === 'fulfilled') {
          setMovies(moviesRes.value.data?.Items || [])
        }
        if (trendingRes.status === 'fulfilled') {
          setTrending(trendingRes.value.data?.Items || [])
        }
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />

      {/* Hero */}
      <HeroSection items={loading ? [] : (latest.length ? latest : movies)} />

      {/* Carousels */}
      <div className="relative -mt-8 z-10 pb-20">
        <MediaCarousel title="Recently Added" items={latest} loading={loading} />
        <MediaCarousel title="Top Rated Movies" items={trending} loading={loading} />
        <MediaCarousel title="All Movies" items={movies} loading={loading} />
      </div>
    </div>
  )
}
