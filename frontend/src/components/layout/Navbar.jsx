import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { useDownloads } from '../../contexts/DownloadContext'
import InstallPWA from '../InstallPWA'

export default function Navbar() {
  const { user, logout } = useAuth()
  const { activeCount } = useDownloads()
  const navigate = useNavigate()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleSearch(e) {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchOpen(false)
      setSearchQuery('')
    }
  }

  const navLinks = [
    { label: 'Home', to: '/browse' },
    { label: 'Movies', to: '/browse/movies' },
    { label: 'TV Shows', to: '/browse/shows' },
    { label: 'Watchlist', to: '/browse/watchlist' },
  ]

  function isActive(to) {
    if (to === '/browse') return location.pathname === '/browse'
    return location.pathname.startsWith(to)
  }

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-zinc-950/95 backdrop-blur-md shadow-lg' : 'bg-gradient-to-b from-zinc-950/80 to-transparent'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/browse" className="flex-shrink-0">
            <span className="text-2xl font-black tracking-tight text-white inline-flex items-center">
              <img src="/logo.png" alt="StreamX" className="w-6 h-6 mr-1.5 -mt-0.5" />
              STREAM<span className="text-violet-500">X</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1 text-sm font-medium">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-3 py-1.5 rounded-md transition-colors ${
                  isActive(link.to)
                    ? 'text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {link.label}
                {isActive(link.to) && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-violet-500"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* PWA Install button */}
            <InstallPWA />

            {/* Search */}
            <AnimatePresence>
              {searchOpen ? (
                <motion.form
                  key="search-form"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 220, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleSearch}
                  className="overflow-hidden"
                >
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={() => !searchQuery && setSearchOpen(false)}
                    placeholder="Search titles..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-white outline-none focus:border-violet-500"
                  />
                </motion.form>
              ) : (
                <button
                  key="search-btn"
                  onClick={() => setSearchOpen(true)}
                  className="p-2 text-zinc-400 hover:text-white transition-colors"
                  aria-label="Search"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                </button>
              )}
            </AnimatePresence>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 p-1 rounded-md hover:bg-zinc-800 transition-colors"
              >
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="w-8 h-8 rounded-md object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-md bg-violet-600 flex items-center justify-center text-xs font-bold uppercase">
                    {user?.username?.[0] || 'U'}
                  </div>
                )}
                <svg className={`w-4 h-4 text-zinc-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-44 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden"
                    onMouseLeave={() => setMenuOpen(false)}
                  >
                    <div className="px-4 py-3 border-b border-zinc-800">
                      <p className="text-xs text-zinc-500">Signed in as</p>
                      <p className="text-sm font-medium truncate">{user?.username}</p>
                    </div>
                    <button
                      onClick={() => { setMenuOpen(false); navigate('/profile') }}
                      className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Profile
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); navigate('/browse/downloads') }}
                      className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2 relative"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Downloads
                      {activeCount > 0 && (
                        <span className="absolute right-3 w-5 h-5 rounded-full bg-violet-600 text-[10px] font-bold flex items-center justify-center">
                          {activeCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={logout}
                      className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-zinc-800 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </motion.nav>
  )
}
