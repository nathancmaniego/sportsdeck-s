// Prompt: Implement a user login endpoint that accepts email and password. Validate the credentials against the database, and if valid, return a JWT token along with user information. Handle errors such as invalid credentials or banned accounts appropriately.
// Claude Sonnet 4.6

import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { prisma } from '@/prisma/db'
import {
  generateToken,
  generateRefreshToken,
  refreshTokenExpiresAt,
  makeRefreshCookie,
} from '@/utils/auth'

export async function POST(request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.password) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      )
    }


    // Clean up any expired leftover tokens
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } })

    const accessToken = generateToken(user)
    const rawRefreshToken = generateRefreshToken()

    await prisma.refreshToken.create({
      data: {
        token: rawRefreshToken,
        userId: user.id,
        expiresAt: refreshTokenExpiresAt(),
      },
    })

    const response = NextResponse.json({
      success: true,
      data: {
        token: accessToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          isBanned: user.isBanned,
        },
      },
    })

    response.headers.set('Set-Cookie', makeRefreshCookie(rawRefreshToken))
    return response

  } catch (error) {
    console.error('[login]', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}