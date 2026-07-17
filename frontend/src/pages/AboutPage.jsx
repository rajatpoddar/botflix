import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { mediaAPI } from '../lib/api'
import PosterCollage from '../components/media/PosterCollage'

export default function AboutPage() {
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
          <h1 className="text-4xl sm:text-5xl font-black mb-6">About StreamX</h1>

          <div className="prose prose-invert prose-zinc max-w-none space-y-8 text-zinc-300 leading-relaxed">
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Our Story</h2>
              <p>
                StreamX was created as a premium streaming interface for users of{' '}
                <a href="https://nregabot.com" className="text-violet-400 hover:text-violet-300 underline">nregabot.com</a>. 
                We believe that accessing your personal media library should be as seamless and 
                beautiful as the major streaming platforms — without the ads, tracking, or limitations.
              </p>
              <p className="mt-4">
                Built on top of a private Jellyfin media server, StreamX transforms your personal 
                media collection into a Netflix-style streaming experience. From any device, anywhere 
                in the world, your movies and TV shows are just a click away.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">What We Offer</h2>
              <div className="grid sm:grid-cols-2 gap-6 mt-4">
                {[
                  { title: 'Personal Streaming', desc: 'Your media, your server — stream from your personal Jellyfin library on any device.' },
                  { title: 'No Ads, Ever', desc: 'We don\'t show advertisements. Your viewing experience is clean and uninterrupted.' },
                  { title: 'Cross-Device Sync', desc: 'Start watching on one device, pick up where you left off on another. Your progress follows you.' },
                  { title: 'Privacy First', desc: 'We don\'t track your viewing habits, sell your data, or share your information with advertisers.' },
                ].map((item, i) => (
                  <div key={i} className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <h3 className="text-white font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-zinc-400">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">For nregabot.com Users</h2>
              <p>
                StreamX is an exclusive value-added service for the nregabot.com community. If you're 
                an existing nregabot.com user, you can enjoy a curated, premium streaming experience 
                using your personal media library. 
              </p>
              <p className="mt-4">
                <a href="https://nregabot.com" className="text-violet-400 hover:text-violet-300 underline">Visit nregabot.com</a> to learn 
                more about our ecosystem of tools and services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Technical Details</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Powered by a private Jellyfin media server for content delivery</li>
                <li>Modern React frontend with responsive design for all screen sizes</li>
                <li>Secure authentication with encrypted password storage (bcrypt)</li>
                <li>HTTPS/SSL encryption for all data in transit</li>
                <li>Razorpay-powered subscription billing with AutoPay</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Contact Us</h2>
              <p>
                Have questions, feedback, or need support? We'd love to hear from you:
              </p>
              <p className="mt-2">
                <strong>Email:</strong> <span className="text-violet-400">streamxcabelwala@gmail.com</span><br />
                <strong>Website:</strong> <a href="https://streamx.cabelwala.com" className="text-violet-400 hover:text-violet-300 underline">https://streamx.cabelwala.com</a><br />
                <strong>Sister Service:</strong> <a href="https://nregabot.com" className="text-violet-400 hover:text-violet-300 underline">nregabot.com</a>
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
