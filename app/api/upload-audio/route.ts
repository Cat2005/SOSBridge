import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    console.log('[Upload API] Received audio file:', {
      name: audioFile.name,
      size: audioFile.size,
      type: audioFile.type,
    })

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const filename = `emergency-${timestamp}.mp3`
    const filepath = join(uploadsDir, filename)

    // Convert File to Buffer and save
    const bytes = await audioFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    console.log('[Upload API] Audio file saved:', filepath)

    // Get the proper origin for the audio URL
    // Check for ngrok forwarded host header
    const forwardedHost = request.headers.get('x-forwarded-host')
    const forwardedProto = request.headers.get('x-forwarded-proto')

    let audioUrl: string
    if (forwardedHost && forwardedProto) {
      // Use ngrok URL
      audioUrl = `${forwardedProto}://${forwardedHost}/uploads/${filename}`
    } else {
      // Fallback to local URL
      audioUrl = `${request.nextUrl.origin}/uploads/${filename}`
    }

    console.log('[Upload API] Generated audio URL:', audioUrl)

    return NextResponse.json({
      success: true,
      audioUrl,
      filename,
    })
  } catch (error) {
    console.error('[Upload API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to upload audio file' },
      { status: 500 }
    )
  }
}
