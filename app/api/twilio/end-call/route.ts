import { NextRequest, NextResponse } from 'next/server'

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN

export async function POST(request: NextRequest) {
  try {
    const { callSid } = await request.json()

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return NextResponse.json(
        { error: 'Missing Twilio credentials' },
        { status: 500 }
      )
    }

    if (!callSid) {
      return NextResponse.json(
        { error: 'Missing required parameter: callSid' },
        { status: 400 }
      )
    }

    console.log('[Twilio API] Ending call:', callSid)

    // End the call using Twilio API
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          Status: 'completed',
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.text()
      console.error('[Twilio API] Error ending call:', errorData)
      return NextResponse.json(
        { error: 'Failed to end Twilio call' },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('[Twilio API] Call ended successfully:', data.sid)

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
