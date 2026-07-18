import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { mediaAPI } from '../lib/api'
import PosterCollage from '../components/media/PosterCollage'

export default function RefundPolicy() {
  const [collageItems, setCollageItems] = useState([])

  useEffect(() => {
    mediaAPI.getLandingData()
      .then((res) => setCollageItems(res.data.collage || []))
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {collageItems.length > 0 ? (
        <PosterCollage items={collageItems} />
      ) : (
        <div className="fixed inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-violet-950" />
      )}

      <nav className="relative z-10 border-b border-zinc-800/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-2xl font-black tracking-tight">
            <img src="/logo.png" alt="StreamX" className="w-5 h-5 inline-block mr-1 -mt-0.5" />
            STREAM<span className="text-violet-500">X</span>
          </Link>
          <Link to="/" className="text-sm text-zinc-400 hover:text-white transition-colors">
            ← Back to Home
          </Link>
        </div>
      </nav>

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl sm:text-5xl font-black mb-2">Refund & Cancellation Policy</h1>
          <p className="text-zinc-500 text-sm mb-12">Last updated: July 17, 2026</p>

          <div className="prose prose-invert prose-zinc max-w-none space-y-8 text-zinc-300 leading-relaxed">
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">1. Service Overview</h2>
              <p>
                StreamX is a completely free streaming service for authorized users of nregabot.com.
                There are no subscription fees, no payment required, and no billing information collected.
                All features are available to every authorized user at no cost.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">2. Cancellation</h2>
              <p>
                Since StreamX is a free service, there is no subscription to cancel. If you wish to 
                stop using the Service, simply stop accessing it. Your account data (watchlist, history) 
                is retained for your convenience if you return.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. Changes to Service</h2>
              <p>
                We reserve the right to modify or discontinue the Service at any time. We will notify 
                users of any significant changes via email.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">4. Contact</h2>
              <p>
                For any questions or concerns, please contact us at{' '}
                <span className="text-violet-400">streamxcabelwala@gmail.com</span>.
              </p>
            </section>
          </div>
        </motion.div>
      </main>

      <footer className="relative z-10 border-t border-zinc-800 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-zinc-600">
          <p>© {new Date().getFullYear()} StreamX. All rights reserved. | <Link to="/" className="hover:text-zinc-400 transition-colors">Home</Link></p>
        </div>
      </footer>
    </div>
  )
}
