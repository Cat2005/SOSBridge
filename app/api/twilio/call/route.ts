import { NextRequest, NextResponse } from 'next/server'

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN

export async function POST(request: NextRequest) {
  try {
    const { to, from, audioUrl } = await request.json()

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return NextResponse.json(
        { error: 'Missing Twilio credentials' },
        { status: 500 }
      )
    }

    if (!to || !from || !audioUrl) {
      return NextResponse.json(
        { error: 'Missing required parameters: to, from, or audioUrl' },
        { status: 400 }
      )
    }

    console.log('[Twilio API] Making call:', { to, from, audioUrl })

    // Get the proper base URL for webhooks
    const forwardedHost = request.headers.get('x-forwarded-host')
    const forwardedProto = request.headers.get('x-forwarded-proto')

    let baseUrl: string
    if (forwardedHost && forwardedProto) {
      // Use ngrok URL
      baseUrl = `${forwardedProto}://${forwardedHost}`
    } else {
      // Fallback to local URL
      baseUrl = request.nextUrl.origin
    }

    const callbackUrl = `${baseUrl}/api/twilio/recording-callback`
    console.log('[Twilio API] Using callback URL:', callbackUrl)

    // Create TwiML for the call
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
  <Record 
    action="${callbackUrl}"
    method="POST"
    maxLength="15"
    playBeep="true"
    trim="trim-silence"
    timeout="3"
  />
</Response>`

    // Make the call using Twilio API
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          From: from,
          Twiml: twiml,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.text()
      console.error('[Twilio API] Error making call:', errorData)
      return NextResponse.json(
        { error: 'Failed to make Twilio call' },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('[Twilio API] Call initiated successfully:', data.sid)

    return NextResponse.json({
      success: true,
      callSid: data.sid,
      status: data.status,
    })
  } catch (error) {
    console.error('[Twilio API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
