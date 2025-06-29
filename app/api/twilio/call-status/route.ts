import { NextRequest, NextResponse } from 'next/server'

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const callSid = searchParams.get('callSid')

    if (!callSid) {
      return NextResponse.json(
        { error: 'Missing callSid parameter' },
        { status: 400 }
      )
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return NextResponse.json(
        { error: 'Missing Twilio credentials' },
        { status: 500 }
      )
    }

    // Get call status from Twilio
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}.json`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
          ).toString('base64')}`,
        },
      }
    )

    if (!response.ok) {
      console.error(
        '[Call Status API] Error fetching call status:',
        response.statusText
      )
      return NextResponse.json(
        { error: 'Failed to fetch call status' },
        { status: response.status }
      )
    }

    const callData = await response.json()

    // Map Twilio status to our app status
    let appStatus: string
    switch (callData.status) {
      case 'queued':
      case 'ringing':
        appStatus = 'ringing'
        break
      case 'in-progress':
        appStatus = 'active'
        break
      case 'completed':
      case 'busy':
      case 'failed':
      case 'no-answer':
        appStatus = 'ended'
        break
      default:
        appStatus = callData.status
    }

    return NextResponse.json({
      success: true,
      status: appStatus,
      twilioStatus: callData.status,
      answeredBy: callData.answered_by,
      duration: callData.duration,
      startTime: callData.start_time,
      endTime: callData.end_time,
    })
  } catch (error) {
    console.error('[Call Status API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
