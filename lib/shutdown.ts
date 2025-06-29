import { stopRateLimitCleanup } from './utils'

let isShuttingDown = false

export function setupGracefulShutdown() {
  if (isShuttingDown) return
  isShuttingDown = true

  console.log('🔄 Setting up graceful shutdown handlers...')

  const cleanup = () => {
    console.log('🛑 Starting graceful shutdown...')

    // Stop rate limiting cleanup
    stopRateLimitCleanup()
    console.log('✅ Rate limiting cleanup stopped')

    // Clean up any active Twilio calls (if needed)
    cleanupAllConversations()
    console.log('✅ All calls cleaned up')

    // Force exit after a short delay to ensure cleanup completes
    setTimeout(() => {
      console.log('🚪 Exiting process...')
      process.exit(0)
    }, 1000)
  }

  // Handle different shutdown signals
  process.on('SIGINT', () => {
    console.log('📱 Received SIGINT (Ctrl+C)')
    cleanup()
  })

  process.on('SIGTERM', () => {
    console.log('📱 Received SIGTERM')
    cleanup()
  })

  process.on('SIGQUIT', () => {
    console.log('📱 Received SIGQUIT')
    cleanup()
  })

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error)
    cleanup()
  })

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason)
    cleanup()
  })

  console.log('✅ Graceful shutdown handlers set up')
}

export function cleanupAllConversations() {
  console.log('[Shutdown] Cleaning up all calls...')
  // With TTS approach, calls are managed by Twilio and will end naturally
  // or can be ended via the Twilio API if needed
  console.log('[Shutdown] No active calls to clean up (TTS-based system)')
}

// Auto-setup on module load
setupGracefulShutdown()
