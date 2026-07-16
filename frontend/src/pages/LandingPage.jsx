import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { mediaAPI, getPublicImageUrl } from '../lib/api'

const features = [
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      </svg>
    ),
    title: 'Unlimited Streaming',
    desc: 'Watch thousands of movies and TV shows on any device — no limits, no ads.',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
    title: 'Your Personal Library',
    desc: 'Resume watching where you left off. Build your watchlist and never lose your place.',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Secure & Private',
    desc: 'Your data stays safe with enterprise-grade encryption. No tracking, no interruptions.',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Always in Sync',
    desc: 'Start watching on your TV, continue on your phone. Your progress follows you everywhere.',
  },
]

const faqs = [
  { q: 'What is StreamX?', a: 'StreamX is a premium streaming platform that brings you thousands of movies and TV shows from your personal Jellyfin media server, all in one beautiful interface.' },
  { q: 'How does the free trial work?', a: 'New users get 7 days of full access completely free. No payment required to start. After your trial ends, it\'s just ₹49/month to continue.' },
  { q: 'Can I cancel anytime?', a: 'Absolutely. There are no contracts or commitments. Cancel anytime — your access continues until the end of your billing period.' },
  { q: 'What devices are supported?', a: 'StreamX works on any modern browser — desktop, tablet, and mobile. No app downloads needed.' },
]

function PosterCollage({ items = [] }) {
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
    <div className="absolute inset-0 overflow-hidden">
      {/* Dark gradient overlays for edges */}
      <div className="absolute inset-0 z-[3] bg-gradient-to-r from-zinc-950 via-transparent to-zinc-950" />
      <div className="absolute inset-0 z-[3] bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-zinc-950/80" />

      <div className="absolute inset-0 flex flex-col gap-3 sm:gap-4 opacity-40 scale-110">
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

function Top10Card({ item, rank, onClick }) {
  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ delay: rank * 0.08 }}
      className="group relative flex-shrink-0 w-36 sm:w-40 cursor-pointer"
    >
      {/* Rank number behind poster */}
      <div className="absolute -left-2 bottom-0 text-[80px] sm:text-[100px] font-black leading-none text-zinc-600/40 select-none"
        style={{ WebkitTextStroke: '1px rgba(255,255,255,0.12)' }}
      >
        {rank}
      </div>

      <div className="relative ml-6 sm:ml-8 aspect-[2/3] rounded-lg overflow-hidden bg-zinc-800 shadow-xl
        transition-transform duration-300 group-hover:scale-105 group-hover:z-10">
        <img
          src={getPublicImageUrl(item.Id, 'Primary', 300, 85)}
          alt={item.Name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-4 h-4 text-zinc-900 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Rating badge */}
      {item.CommunityRating && (
        <div className="absolute top-1 right-1 sm:right-2 z-10 bg-black/70 rounded px-1 py-0.5 text-[10px] font-medium flex items-center gap-0.5">
          <svg className="w-2.5 h-2.5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          {item.CommunityRating.toFixed(1)}
        </div>
      )}
    </motion.div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [landingData, setLandingData] = useState({ collage: [], trending: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Fetch movie data for the landing page
  useEffect(() => {
    async function fetchLandingData() {
      try {
        const res = await mediaAPI.getLandingData()
        setLandingData(res.data)
      } catch {
        // Landing page works even without data
      } finally {
        setLoading(false)
      }
    }
    fetchLandingData()
  }, [])

  const scrollToPricing = () => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
  }

  const collageItems = landingData.collage || []
  const trendingItems = landingData.trending || []

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden">
      {/* ── Navbar ── */}
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-zinc-950/95 backdrop-blur-md shadow-lg' : 'bg-gradient-to-b from-zinc-950/80 to-transparent'
        }`}
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <span className="text-2xl font-black tracking-tight">
              STREAM<span className="text-violet-500">X</span>
            </span>
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="text-sm text-zinc-300 hover:text-white font-medium transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="text-sm bg-violet-600 hover:bg-violet-500 text-white font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* ── Hero with Netflix-style Poster Collage ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Poster Collage Background */}
        {!loading && collageItems.length > 0 ? (
          <PosterCollage items={collageItems} />
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-violet-950" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/30 via-transparent to-transparent" />
            <div className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
                backgroundSize: '60px 60px',
              }}
            />
          </>
        )}

        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium mb-6 backdrop-blur-sm">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
              Unlimited streaming. Zero ads.
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-tight drop-shadow-lg">
              Unlimited{' '}
              <span className="bg-gradient-to-r from-violet-400 to-violet-600 bg-clip-text text-transparent">
                Movies & TV
              </span>
              <br />
              At Your Fingertips
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-zinc-300 max-w-2xl mx-auto leading-relaxed drop-shadow-md">
              Stream your personal media collection from anywhere. Start your{' '}
              <span className="text-white font-semibold">7-day free trial</span> today.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate('/signup')}
                className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-10 py-4 rounded-xl text-lg transition-all shadow-xl shadow-violet-900/30 hover:shadow-violet-900/50 active:scale-95"
              >
                Start Free Trial
              </button>
              <button
                onClick={scrollToPricing}
                className="bg-zinc-800/80 hover:bg-zinc-700 text-white font-semibold px-10 py-4 rounded-xl text-lg border border-zinc-700 transition-all active:scale-95 backdrop-blur-sm"
              >
                See Plans
              </button>
            </div>

            <p className="mt-4 text-xs text-zinc-500">No credit card required. Cancel anytime.</p>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </motion.div>
      </section>

      {/* ── Top 10 Trending Movies ── */}
      {trendingItems.length > 0 && (
        <section className="relative py-16 sm:py-24 bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              className="flex items-center gap-4 mb-10"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Top 10 Trending</h2>
              </div>
              <div className="hidden sm:flex-1 sm:flex h-px bg-gradient-to-r from-zinc-800 to-transparent" />
            </motion.div>

            {/* Horizontal scrollable row */}
            <div className="relative">
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
                {trendingItems.map((item, i) => (
                  <Top10Card key={item.Id} item={item} rank={i + 1} onClick={() => navigate('/signup')} />
                ))}
              </div>
              {/* Fade edges */}
              <div className="absolute top-0 left-0 bottom-4 w-8 bg-gradient-to-r from-zinc-950 to-transparent pointer-events-none sm:hidden" />
              <div className="absolute top-0 right-0 bottom-4 w-8 bg-gradient-to-l from-zinc-950 to-transparent pointer-events-none sm:hidden" />
            </div>
          </div>
        </section>
      )}

      {/* ── Features ── */}
      <section className="relative py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold">Everything You Need</h2>
            <p className="mt-4 text-zinc-400 max-w-lg mx-auto">
              A beautiful way to watch your media collection, with all the features you expect.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: i * 0.1 }}
                className="group p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all hover:bg-zinc-900/80"
              >
                <div className="w-12 h-12 rounded-xl bg-violet-600/10 flex items-center justify-center text-violet-400 mb-4 group-hover:bg-violet-600/20 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="relative py-24 sm:py-32 bg-gradient-to-b from-transparent via-violet-950/10 to-transparent">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold">Simple Pricing</h2>
            <p className="mt-4 text-zinc-400">One plan. No hidden fees. Cancel anytime.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            className="relative rounded-3xl border border-violet-500/30 bg-gradient-to-b from-violet-950/30 to-zinc-950/80 p-8 sm:p-10 shadow-2xl shadow-violet-900/20"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-violet-600 text-white text-xs font-semibold">
              MOST POPULAR
            </div>

            <div className="text-center">
              <h3 className="text-xl font-bold mb-2">Premium Plan</h3>
              <div className="flex items-baseline justify-center gap-1 mt-4">
                <span className="text-5xl font-black">₹49</span>
                <span className="text-zinc-400">/month</span>
              </div>
              <p className="mt-4 text-sm text-zinc-400">
                Start with a <span className="text-violet-400 font-semibold">7-day free trial</span>. No credit card required.
              </p>
            </div>

            <ul className="mt-8 space-y-4">
              {[
                'Unlimited movies & TV shows',
                'Resume watching on any device',
                '4K & HDR streaming',
                'Download for offline viewing',
                'No ads — ever',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                  <svg className="w-5 h-5 text-violet-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            <button
              onClick={() => navigate('/signup')}
              className="mt-8 w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 rounded-xl text-lg transition-all active:scale-95"
            >
              Start Your Free Trial
            </button>
            <p className="mt-3 text-xs text-zinc-600 text-center">Cancel anytime during trial — no charge.</p>
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 sm:py-32">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-center mb-12"
          >
            Frequently Asked Questions
          </motion.h2>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <FaqItem key={i} question={faq.q} answer={faq.a} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="py-16 border-t border-zinc-800">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Ready to watch?
          </h2>
          <p className="text-zinc-400 mb-8">
            Start your 7-day free trial today. No commitment, no risk.
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-10 py-4 rounded-xl text-lg transition-all active:scale-95"
          >
            Get Started Free
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-zinc-600">
          <span className="text-lg font-black tracking-tight">
            STREAM<span className="text-violet-500">X</span>
          </span>
          <p className="mt-2">© {new Date().getFullYear()} StreamX. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

function FaqItem({ question, answer, index }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl border border-zinc-800 overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left text-sm font-medium hover:bg-zinc-900/50 transition-colors"
      >
        {question}
        <svg
          className={`w-4 h-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-4 text-sm text-zinc-400 leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
