// Prompt: Implement a user logout endpoint that invalidates the user's JWT token. Since JWT is stateless, you can simply return a success response and let the client handle token removal. Optionally, you could implement token blacklisting if you want to invalidate tokens server-side.
// Claude Sonnet 4.6

// JWT is stateless so logout is handled client-side
// Just return success and the client discards the token
import { NextRequest, NextResponse } from "next/server"
import { prisma } from '@/prisma/db'

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie') ?? ''
    const rawToken = parseCookie(cookieHeader, 'refreshToken')

    // No cookie at all — not logged in
    if (!rawToken) {
      return NextResponse.json(
        { success: false, error: 'Not logged in' },
        { status: 401 }
      )
    }

    // Cookie present but not in DB — already logged out or invalid
    const stored = await prisma.refreshToken.findUnique({
      where: { token: rawToken },
    })

    if (!stored || stored.expiresAt < new Date()) {
      return clearCookieResponse(
        { success: false, error: 'Not logged in' },
        401
      )
    }

    // Valid session — delete it
    await prisma.refreshToken.delete({ where: { token: rawToken } })

    return clearCookieResponse({ success: true, data: { message: 'Logged out successfully' } })

  } catch (error) {
    console.error('[logout]', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function parseCookie(header: string, name: string): string | null {
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

function clearCookieResponse(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status })
  response.headers.set(
    'Set-Cookie',
    'refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0'
  )
  return response
}