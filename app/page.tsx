'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import EmergencyForm from '@/components/EmergencyForm';
import ErrorBanner from '@/components/ErrorBanner';
import { Shield, Heart, Phone } from 'lucide-react';

export default function Home() {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-4 relative">
      {error && (
        <ErrorBanner 
          message={error} 
          onDismiss={() => setError(null)} 
        />
      )}
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mx-auto w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mb-4"
          >
            <Shield className="w-8 h-8 text-white" />
          </motion.div>
          
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-slate-100 mb-2">
            Silent SOS
          </h1>
          <p className="text-neutral-600 dark:text-slate-400 text-sm leading-relaxed">
            Secure, silent emergency communication platform
          </p>
        </div>

        {/* Main Form Card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-neutral-200 dark:border-slate-800 p-6"
        >
          <EmergencyForm onError={setError} />
        </motion.div>

        {/* Info Cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 grid grid-cols-2 gap-3"
        >
          <div className="bg-white/50 dark:bg-slate-900/50 rounded-xl p-4 text-center backdrop-blur-sm border border-neutral-200 dark:border-slate-800">
            <Heart className="w-5 h-5 text-emerald-600 mx-auto mb-2" />
            <p className="text-xs text-neutral-600 dark:text-slate-400">
              Secure & Private
            </p>
          </div>
          <div className="bg-white/50 dark:bg-slate-900/50 rounded-xl p-4 text-center backdrop-blur-sm border border-neutral-200 dark:border-slate-800">
            <Phone className="w-5 h-5 text-emerald-600 mx-auto mb-2" />
            <p className="text-xs text-neutral-600 dark:text-slate-400">
              24/7 Available
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}