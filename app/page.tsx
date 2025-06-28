'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import EmergencyForm from '@/components/EmergencyForm'
import ErrorBanner from '@/components/ErrorBanner'
import Image from 'next/image'

export default function Home() {
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-4 relative bg-[#0E1017]">
      {error && (
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="relative">
            <Image
              src="/web-logo.svg"
              alt="Logo"
              width={250}
              height={250}
              className="object-contain"
              priority
            />
          </motion.div>
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
