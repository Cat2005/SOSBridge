import { NextRequest, NextResponse } from 'next/server'

// In-memory storage for transcriptions (in production, use a database)
const transcriptionStore = new Map<
  string,
  Array<{
    text: string
    timestamp: number
    callSid: string
  }>
>()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const callSid = searchParams.get('callSid')
    const since = searchParams.get('since')

    if (!callSid) {
      return NextResponse.json(
        { error: 'Missing callSid parameter' },
        { status: 400 }
      )
    }

    const sinceTime = since ? parseInt(since) : 0
    const transcriptions = transcriptionStore.get(callSid) || []

    // Filter transcriptions since the last check
    const newTranscriptions = transcriptions.filter(
      (transcription) => transcription.timestamp > sinceTime
    )

    return NextResponse.json({
      success: true,
      transcriptions: newTranscriptions,
    })
  } catch (error) {
    console.error('[Get Transcriptions API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Function to add transcriptions (called from recording callback)
export function addTranscription(callSid: string, text: string) {
  const transcription = {
    text,
    timestamp: Date.now(),
    callSid,
  }

  const existingTranscriptions = transcriptionStore.get(callSid) || []
  existingTranscriptions.push(transcription)
  transcriptionStore.set(callSid, existingTranscriptions)

  console.log('[Transcription Store] Added transcription:', {
    callSid,
    text,
    timestamp: transcription.timestamp,
  })
}
