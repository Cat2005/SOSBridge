# Rate Limiting System

This application implements comprehensive rate limiting to prevent abuse and excessive API calls to ElevenLabs and Twilio.

## Rate Limits

### Emergency API (`/api/emergency`)

- **Limit**: 5 requests per hour per IP address
- **Purpose**: Prevent spam emergency requests
- **Headers**: `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-RateLimit-Limit`

### ElevenLabs TTS API

- **Limit**: 20 TTS requests per hour per IP address
- **Purpose**: Prevent excessive ElevenLabs TTS usage
- **Headers**: `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-RateLimit-Limit`

### Twilio Call API

- **Limit**: 10 calls per hour per IP address
- **Purpose**: Prevent excessive Twilio API usage
- **Headers**: `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-RateLimit-Limit`

### Call-Level Limits

- **Per Session**: 1 active call at a time
- **Cooldown**: 30 seconds between call attempts
- **Global**: 3 calls per minute, 10 calls per hour across all sessions

## Implementation Details

### Rate Limiting Layers

1. **API-Level Rate Limiting** (`lib/utils.ts`)

   - IP-based rate limiting for API endpoints
   - Sliding window implementation
   - Automatic cleanup of expired entries

2. **Call-Level Rate Limiting** (Client-side)

   - Session-based call tracking
   - Duplicate call prevention
   - Call state management

3. **Client-Side Protection** (`components/Chat.tsx`)
   - Call initialization tracking
   - Error handling for rate limit responses
   - Retry mechanism with proper cooldown

### Rate Limit Headers

All API responses include rate limit information:

```
X-RateLimit-Remaining: 8
X-RateLimit-Reset: 1640995200000
X-RateLimit-Limit: 10
```

### Error Responses

When rate limits are exceeded, APIs return:

```json
{
  "success": false,
  "error": "Too many API calls. Please wait before trying again.",
  "retryAfter": 1800
}
```

## Monitoring

### Status Component

The Chat component displays:

- Current call status
- Processing states (speaking, uploading, etc.)
- Visual indicators for rate limit status

### Logging

All rate limit events are logged with:

- Client IP address
- Session ID
- API endpoint
- Rate limit type

## TTS-Specific Considerations

### ElevenLabs TTS Limits

- **Character Limit**: 5000 characters per request
- **Audio Length**: Maximum 10 minutes per audio file
- **Concurrent Requests**: 5 simultaneous TTS requests

### Twilio Call Limits

- **Call Duration**: Maximum 4 hours per call
- **Recording Size**: Maximum 100MB per recording
- **Concurrent Calls**: Based on your Twilio plan

## Best Practices

1. **Batch Processing**: Combine multiple short messages into one TTS request
2. **Caching**: Cache frequently used audio files
3. **Error Handling**: Implement exponential backoff for retries
4. **Monitoring**: Track usage patterns and adjust limits accordingly

## Troubleshooting

- Check rate limit headers in API responses
- Monitor server logs for rate limit violations
- Verify environment variable configuration
- Ensure proper error handling in client code

## Security Considerations

- Rate limits are per IP address (can be bypassed with proxies)
- Consider implementing user authentication for stricter limits
- Monitor for unusual patterns that might indicate abuse
- Implement additional security measures for production use
