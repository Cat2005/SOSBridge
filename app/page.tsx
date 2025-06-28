'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import EmergencyForm from '@/components/EmergencyForm'
import ErrorBanner from '@/components/ErrorBanner'
import { Shield } from 'lucide-react'

export default function Home() {
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-4 relative bg-slate-900">
      {error && (
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8 flex items-center justify-center gap-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-white" />
          </motion.div>

          <h1 className="text-3xl font-bold text-slate-100">SOS Bridge</h1>
        </div>

        {/* Main Form Card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}>
          <EmergencyForm onError={setError} />
        </motion.div>
      </motion.div>
    </div>
  )
}
