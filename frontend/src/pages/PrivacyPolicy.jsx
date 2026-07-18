import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { mediaAPI } from '../lib/api'
import PosterCollage from '../components/media/PosterCollage'

export default function PrivacyPolicy() {
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
          <h1 className="text-4xl sm:text-5xl font-black mb-2">Privacy Policy</h1>
          <p className="text-zinc-500 text-sm mb-12">Last updated: July 17, 2026</p>

          <div className="prose prose-invert prose-zinc max-w-none space-y-8 text-zinc-300 leading-relaxed">
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
              <p>
                CabelWala ("we," "us," or "our") operates StreamX at{' '}
                <a href="https://streamx.cabelwala.com" className="text-violet-400 hover:text-violet-300 underline">https://streamx.cabelwala.com</a> 
                (the "Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard 
                your information when you use our Service.
              </p>
              <p className="mt-4">
                StreamX is a streaming interface exclusively for authorized users of{' '}
                <a href="https://nregabot.com" className="text-violet-400 hover:text-violet-300 underline">nregabot.com</a>. 
                By using the Service, you consent to the practices described in this policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>
              <h3 className="text-lg font-semibold text-white mt-4 mb-2">Account Information</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Email Address:</strong> Used for account identification, login, and communication</li>
                <li><strong>Username:</strong> Used for profile display within the Service</li>
                <li><strong>Password:</strong> Stored securely using hashed encryption (bcrypt)</li>
              </ul>
              <h3 className="text-lg font-semibold text-white mt-4 mb-2">Usage Data</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Watch history and playback progress (to enable resume-watching feature)</li>
                <li>Watchlist items (favorites and saved content)</li>
                <li>Search queries made within the Service</li>
                <li>Viewing preferences and settings</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. How We Use Your Information</h2>
              <p>We use the collected information for the following purposes:</p>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li>To provide, maintain, and improve the Service</li>
                <li>To authenticate your identity and authorize access</li>
                <li>To send service-related communications (welcome emails, password resets)</li>
                <li>To personalize your streaming experience (resume playback, recommendations)</li>
                <li>To detect, prevent, and address technical issues or security breaches</li>
                <li>To comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">4. Data Sharing & Disclosure</h2>
              <p>We do not sell, trade, or rent your personal information to third parties. We may share information only in the following circumstances:</p>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li><strong>Service Providers:</strong> We do not share your data with any third-party services.</li>
                <li><strong>Legal Compliance:</strong> When required by law, court order, or governmental regulation</li>
                <li><strong>Protection of Rights:</strong> To enforce our Terms of Service or protect against fraud or abuse</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">5. Data Retention</h2>
              <p>
                We retain your account information for as long as your account remains active. If you 
                delete your account or request deletion, we will remove or anonymize your personal data 
                within 30 days, except where retention is required by law (e.g., billing records).
              </p>
              <p className="mt-4">
                Watch history and usage data are retained to provide continuity of service and may be 
                anonymized for analytics purposes after account deletion.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">6. Data Security</h2>
              <p>
                We implement industry-standard security measures to protect your data:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li>All data transmitted between your browser and our servers is encrypted using TLS/SSL</li>
                <li>Passwords are hashed using bcrypt — we never store plain-text passwords</li>
                <li>Database access is restricted to authorized services only</li>

              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">7. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate or incomplete data</li>
                <li>Request deletion of your account and associated data</li>
                <li>Export your data in a portable format</li>
                <li>Withdraw consent where processing is based on consent</li>
              </ul>
              <p className="mt-4">
                To exercise any of these rights, contact us at{' '}
                <span className="text-violet-400">streamxcabelwala@gmail.com</span>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">8. Cookies & Tracking</h2>
              <p>
                StreamX uses essential cookies for authentication and session management. These cookies 
                are necessary for the Service to function properly. We do not use tracking cookies, 
                advertising cookies, or third-party analytics that collect personal data.
              </p>

            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">9. Third-Party Links</h2>
              <p>
                The Service may contain links to third-party websites or services (including 
                nregabot.com). We are not responsible for the privacy practices of these third parties. 
                We encourage you to review their privacy policies before providing any personal information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">10. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify users of material 
                changes via email or through a prominent notice on the Service. The "Last updated" date 
                at the top of this page indicates when the policy was last revised.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">11. Contact Us</h2>
              <p>
                If you have questions or concerns about this Privacy Policy, please reach out:
              </p>
              <p className="mt-2">
                <strong>Email:</strong> <span className="text-violet-400">streamxcabelwala@gmail.com</span><br />
                <strong>Website:</strong> <a href="https://streamx.cabelwala.com" className="text-violet-400 hover:text-violet-300 underline">https://streamx.cabelwala.com</a><br />
                <strong>Associated Service:</strong> <a href="https://nregabot.com" className="text-violet-400 hover:text-violet-300 underline">nregabot.com</a>
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
