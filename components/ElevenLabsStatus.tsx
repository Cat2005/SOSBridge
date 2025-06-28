'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Wifi, AlertCircle, CheckCircle, Settings, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ElevenLabsConfig {
  configured: boolean
  missing?: {
    ELEVEN_API_KEY: boolean
    ELEVEN_AGENT_ID: boolean
    ELEVEN_PHONE_ID: boolean
    CALLEE_NUMBER: boolean
  }
}

export default function ElevenLabsStatus() {
  const [status, setStatus] = useState<
    'checking' | 'connected' | 'disconnected'
  >('checking')
  const [config, setConfig] = useState<ElevenLabsConfig | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    remaining: number
    resetTime: number
  } | null>(null)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/elevenlabs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: 'status-check',
            action: 'status',
          }),
        })

        const data = await response.json()

        if (data.success && data.configured) {
          setStatus('connected')
          // Extract rate limit info from headers if available
          const remaining = response.headers.get('x-ratelimit-remaining')
          const resetTime = response.headers.get('x-ratelimit-reset')
          if (remaining && resetTime) {
            setRateLimitInfo({
              remaining: parseInt(remaining),
              resetTime: parseInt(resetTime),
            })
          }
        } else {
          setStatus('disconnected')
          setConfig(data)
        }
      } catch (error) {
        console.error('Error checking ElevenLabs status:', error)
        setStatus('disconnected')
      }
    }

    checkStatus()
  }, [])

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />
      case 'disconnected':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      default:
        return <Wifi className="w-4 h-4 text-yellow-600 animate-pulse" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'AI Call Ready'
      case 'disconnected':
        return 'AI Call Unavailable'
      default:
        return 'Checking Status...'
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'text-emerald-600 dark:text-emerald-400'
      case 'disconnected':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-yellow-600 dark:text-yellow-400'
    }
  }

  const getRateLimitColor = () => {
    if (!rateLimitInfo) return 'text-neutral-500'
    if (rateLimitInfo.remaining <= 2) return 'text-red-600'
    if (rateLimitInfo.remaining <= 5) return 'text-yellow-600'
    return 'text-emerald-600'
  }

  return (
    <div className="space-y-2">
      {/* Status Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className={`text-xs font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>

        {status === 'disconnected' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="p-1 h-auto">
            <Settings className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Rate Limit Info */}
      {status === 'connected' && rateLimitInfo && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="flex items-center space-x-1 text-xs">
          <Shield className="w-3 h-3" />
          <span className={`${getRateLimitColor()}`}>
            {rateLimitInfo.remaining} calls remaining
          </span>
        </motion.div>
      )}

      {/* Configuration Details */}
      {showDetails && config && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <h4 className="text-xs font-medium text-red-800 dark:text-red-200 mb-2">
            Missing Configuration
          </h4>
          <ul className="space-y-1">
            {config.missing?.ELEVEN_API_KEY && (
              <li className="text-xs text-red-700 dark:text-red-300">
                • ELEVEN_API_KEY
              </li>
            )}
            {config.missing?.ELEVEN_AGENT_ID && (
              <li className="text-xs text-red-700 dark:text-red-300">
                • ELEVEN_AGENT_ID
              </li>
            )}
            {config.missing?.ELEVEN_PHONE_ID && (
              <li className="text-xs text-red-700 dark:text-red-300">
                • ELEVEN_PHONE_ID
              </li>
            )}
            {config.missing?.CALLEE_NUMBER && (
              <li className="text-xs text-red-700 dark:text-red-300">
                • CALLEE_NUMBER
              </li>
            )}
          </ul>
          <p className="text-xs text-red-600 dark:text-red-400 mt-2">
            Add these to your .env file to enable AI-powered calls.
          </p>
        </motion.div>
      )}
    </div>
  )
}
