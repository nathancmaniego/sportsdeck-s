import { NextResponse } from 'next/server'

// Prompt: Implement a user logout endpoint that invalidates the user's JWT token. Since JWT is stateless, you can simply return a success response and let the client handle token removal. Optionally, you could implement token blacklisting if you want to invalidate tokens server-side.
// Claude Sonnet 4.6

// JWT is stateless so logout is handled client-side
// Just return success and the client discards the token
export async function POST() {
  return NextResponse.json({
    success: true,
    data: { message: 'Logged out successfully' }
  })
}