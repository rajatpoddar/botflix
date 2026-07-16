import MediaCard from './MediaCard'

export default function MediaGrid({ items = [], loading = false }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] rounded-lg bg-zinc-800 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="text-center py-20 text-zinc-500">
        <p className="text-lg">Nothing here yet</p>
        <p className="text-sm mt-2">Check back later or try a different filter</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {items.map((item) => (
        <MediaCard key={item.Id} item={item} />
      ))}
    </div>
  )
}
