# Rate Limiting System

This application implements comprehensive rate limiting to prevent abuse and excessive API calls to ElevenLabs.

## Rate Limits

### Emergency API (`/api/emergency`)

- **Limit**: 5 requests per hour per IP address
- **Purpose**: Prevent spam emergency requests
- **Headers**: `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-RateLimit-Limit`

### ElevenLabs API (`/api/elevenlabs`)

- **Limit**: 10 calls per hour per IP address
- **Purpose**: Prevent excessive ElevenLabs API usage
- **Headers**: `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-RateLimit-Limit`

### Conversation-Level Limits

- **Per Session**: 1 active call at a time
- **Cooldown**: 30 seconds between call attempts
- **Global**: 3 calls per minute, 10 calls per hour across all sessions

## Implementation Details

### Rate Limiting Layers

1. **API-Level Rate Limiting** (`lib/utils.ts`)

   - IP-based rate limiting for API endpoints
   - Sliding window implementation
   - Automatic cleanup of expired entries

2. **Conversation-Level Rate Limiting** (`lib/conversation.ts`)

   - Session-based call tracking
   - Duplicate call prevention
   - Call state management

3. **Client-Side Protection** (`app/chat/[sessionId]/page.tsx`)
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

The `ElevenLabsStatus` component displays:

- Current connection status
- Remaining API calls (when available)
- Visual indicators for rate limit status

### Logging

All rate limit events are logged with:

- Client IP address
- Session ID
- Rate limit remaining count
- Timestamp

## Configuration

Rate limits can be adjusted in:

- `lib/conversation.ts`: Conversation-level limits
- `lib/utils.ts`: API-level limits
- `pages/api/emergency.ts`: Emergency API limits
- `pages/api/elevenlabs.ts`: ElevenLabs API limits

## Best Practices

1. **Always check rate limit headers** in client applications
2. **Implement exponential backoff** for retry attempts
3. **Show user-friendly error messages** when limits are hit
4. **Monitor rate limit usage** to adjust limits as needed
5. **Clean up expired rate limit data** to prevent memory leaks

## Troubleshooting

### Common Issues

1. **"Too many call attempts" error**

   - Wait 30 seconds before retrying
   - Check if another call is already active

2. **"Hourly call limit exceeded" error**

   - Wait for the hourly window to reset
   - Consider implementing a queue system for high-volume usage

3. **Rate limit headers not showing**
   - Ensure the client is reading response headers
   - Check if the rate limiting middleware is properly configured

### Debugging

Enable debug logging by setting:

```javascript
console.log('[Rate Limit]', { identifier, remaining, resetTime })
```

## Security Considerations

- Rate limits are per IP address (can be bypassed with proxies)
- Consider implementing user authentication for stricter limits
- Monitor for unusual patterns that might indicate abuse
- Implement additional security measures for production use
