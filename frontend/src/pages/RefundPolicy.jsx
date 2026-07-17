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
              <h2 className="text-2xl font-bold text-white mb-4">1. Subscription Overview</h2>
              <p>
                StreamX operates on a recurring subscription model. All new users receive a{' '}
                <strong className="text-white">7-day free trial</strong> with complete access to the 
                Service. After the trial period ends, the subscription fee of ₹49 per month is charged 
                automatically via <a href="https://razorpay.com" className="text-violet-400 hover:text-violet-300 underline">Razorpay</a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">2. Free Trial</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>New users get 7 days of free, unlimited access to StreamX</li>
                <li>No payment information is required to start the trial</li>
                <li>You will not be charged during the trial period under any circumstances</li>
                <li>You may cancel at any time during the trial with no obligation</li>
                <li>Access ends immediately after the 7-day trial if you do not subscribe</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. Cancellation Policy</h2>
              <p>
                You may cancel your subscription at any time through your account settings in the 
                Profile section of the Service. Here's what happens when you cancel:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li><strong>Immediate Effect:</strong> Your recurring billing is stopped immediately</li>
                <li><strong>No Loss of Access:</strong> You retain full access to the Service until the end of your current paid billing period</li>
                <li><strong>No Partial Refunds:</strong> We do not issue partial refunds for the unused portion of a billing period</li>
                <li><strong>Downgrade:</strong> At the end of the billing period, your account is downgraded to free access (if applicable)</li>
                <li><strong>Data Retention:</strong> Your account data (watchlist, history) is retained for 30 days after cancellation in case you wish to resubscribe</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">4. Refund Policy</h2>
              <p>
                Due to the nature of digital streaming services, StreamX generally does not offer 
                refunds for subscription fees. However, we may issue refunds on a case-by-case basis 
                under the following circumstances:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li><strong>Technical Failure:</strong> If the Service is unavailable due to a technical error on our end for more than 48 consecutive hours, and you are unable to access any content during that period</li>
                <li><strong>Duplicate Charge:</strong> If you were charged twice for the same billing period due to a processing error</li>
                <li><strong>Unauthorized Charge:</strong> If a subscription was activated without your authorization (requires proof)</li>
              </ul>
              <p className="mt-4">
                To request a refund, please contact us at{' '}
                <span className="text-violet-400">streamxcabelwala@gmail.com</span> with your account 
                details and reason for the request. We will respond within 5-7 business days.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">5. How to Cancel</h2>
              <p>To cancel your subscription:</p>
              <ol className="list-decimal pl-6 mt-2 space-y-2">
                <li>Log in to your StreamX account at <a href="https://streamx.cabelwala.com" className="text-violet-400 hover:text-violet-300 underline">streamx.cabelwala.com</a></li>
                <li>Navigate to your <strong>Profile</strong> page</li>
                <li>Under the Subscription section, click <strong>"Cancel Subscription"</strong></li>
                <li>Confirm the cancellation</li>
              </ol>
              <p className="mt-4">
                You will receive a confirmation email from us upon successful cancellation. If you do not 
                receive this email within 24 hours, please contact us at{' '}
                <span className="text-violet-400">streamxcabelwala@gmail.com</span>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">6. Reactivation</h2>
              <p>
                If you cancel and later wish to resubscribe, you may do so at any time. Simply log in 
                to your account and follow the subscription prompts. Your watch history, watchlist, and 
                settings will be preserved for 30 days after cancellation.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">7. Contact for Billing Issues</h2>
              <p>
                For any billing-related questions, concerns, or disputes, please contact us:
              </p>
              <p className="mt-2">
                <strong>Email:</strong> <span className="text-violet-400">streamxcabelwala@gmail.com</span><br />
                <strong>Subject:</strong> Please use "Billing Inquiry" as the email subject for faster processing
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
