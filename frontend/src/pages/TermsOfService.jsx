import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { mediaAPI } from '../lib/api'
import PosterCollage from '../components/media/PosterCollage'

export default function TermsOfService() {
  const [collageItems, setCollageItems] = useState([])

  useEffect(() => {
    mediaAPI.getLandingData()
      .then((res) => setCollageItems(res.data.collage || []))
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Background */}
      {collageItems.length > 0 ? (
        <PosterCollage items={collageItems} />
      ) : (
        <div className="fixed inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-violet-950" />
      )}

      {/* Nav */}
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

      {/* Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl sm:text-5xl font-black mb-2">Terms of Service</h1>
          <p className="text-zinc-500 text-sm mb-12">Last updated: July 17, 2026</p>

          <div className="prose prose-invert prose-zinc max-w-none space-y-8 text-zinc-300 leading-relaxed">
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
              <p>
                Welcome to StreamX ("the Service"), operated by CabelWala. By accessing or using StreamX 
                at <a href="https://streamx.cabelwala.com" className="text-violet-400 hover:text-violet-300 underline">https://streamx.cabelwala.com</a>, 
                you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.
              </p>
              <p className="mt-4">
                StreamX is an exclusive service provided to users of{' '}
                <a href="https://nregabot.com" className="text-violet-400 hover:text-violet-300 underline">nregabot.com</a>. 
                By using this Service, you confirm that you are an authorized user of nregabot.com.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">2. Service Description</h2>
              <p>
                StreamX provides a premium web-based interface for streaming personal media content 
                from a private Jellyfin media server. The Service allows authorized users to browse, 
                search, and stream movies and TV shows from their personal media library through a 
                modern, ad-free interface.
              </p>
              <p className="mt-4">
                The Service is an add-on value offering for users of nregabot.com and does not host, 
                distribute, or transmit any copyrighted content on its own behalf. All media content 
                is sourced exclusively from the user's personal, authorized Jellyfin media server.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. User Accounts & Registration</h2>
              <p>To access StreamX, you must:</p>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li>Be an authorized user of nregabot.com</li>
                <li>Create an account with a valid email address</li>
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security and confidentiality of your account credentials</li>
                <li>Be at least 18 years of age or have parental consent</li>
              </ul>
              <p className="mt-4">
                You are responsible for all activity that occurs under your account. Notify us immediately 
                of any unauthorized use at <span className="text-violet-400">streamxcabelwala@gmail.com</span>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">4. Subscriptions & Billing</h2>
              <p>
                StreamX operates on a subscription-based model with the following terms:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li><strong>Free Trial:</strong> New users receive a 7-day free trial with full access to the Service.</li>
                <li><strong>Subscription Fee:</strong> After the trial, the subscription is ₹49 per month (plus applicable taxes).</li>
                <li><strong>AutoPay:</strong> Subscriptions are billed automatically at the start of each billing cycle via Razorpay.</li>
                <li><strong>Price Changes:</strong> We reserve the right to modify pricing with 30 days' prior notice via email.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">5. Cancellation & Refunds</h2>
              <p>
                You may cancel your subscription at any time through your account settings. Upon cancellation:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li>You will continue to have access to the Service until the end of your current billing period.</li>
                <li>No partial refunds will be issued for the remaining days in the current billing period.</li>
                <li>Your account will be downgraded to free/trial status at the end of the billing cycle.</li>
              </ul>
              <p className="mt-4">
                If you experience technical issues that prevent access to the Service for more than 48 consecutive hours, 
                please contact us at <span className="text-violet-400">streamxcabelwala@gmail.com</span> for assistance.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">6. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li>Use the Service for any illegal purpose or in violation of applicable laws</li>
                <li>Share your account credentials with unauthorized users</li>
                <li>Attempt to circumvent access controls or subscription restrictions</li>
                <li>Use automated tools, bots, or scrapers to access the Service</li>
                <li>Reverse engineer, decompile, or disassemble any aspect of the Service</li>
                <li>Upload or distribute any malicious code or content</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">7. Intellectual Property</h2>
              <p>
                The StreamX name, logo, interface design, and software code are proprietary and protected 
                by applicable intellectual property laws. The Service's interface and technology are owned 
                and operated by CabelWala.
              </p>
              <p className="mt-4">
                Media content accessible through the Service is the property of the respective users and 
                is stored on their personal Jellyfin media servers. We do not claim ownership of any 
                user-uploaded or user-sourced media content.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">8. Limitation of Liability</h2>
              <p>
                StreamX is provided "as is" and "as available" without warranties of any kind, either 
                express or implied. We do not guarantee that the Service will be uninterrupted, secure, 
                or error-free.
              </p>
              <p className="mt-4">
                To the fullest extent permitted by law, CabelWala shall not be liable for any indirect, 
                incidental, special, consequential, or punitive damages arising from your use of the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">9. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. Changes will be effective immediately 
                upon posting. We will notify users of material changes via email. Continued use of the Service 
                after changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">10. Contact Information</h2>
              <p>
                For questions, concerns, or support regarding these Terms, please contact us at:
              </p>
              <p className="mt-2">
                <strong>Email:</strong> <span className="text-violet-400">streamxcabelwala@gmail.com</span><br />
                <strong>Website:</strong> <a href="https://streamx.cabelwala.com" className="text-violet-400 hover:text-violet-300 underline">https://streamx.cabelwala.com</a><br />
                <strong>Service for:</strong> <a href="https://nregabot.com" className="text-violet-400 hover:text-violet-300 underline">nregabot.com</a>
              </p>
            </section>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-zinc-600">
          <p>© {new Date().getFullYear()} StreamX. All rights reserved. | <Link to="/" className="hover:text-zinc-400 transition-colors">Home</Link></p>
        </div>
      </footer>
    </div>
  )
}
