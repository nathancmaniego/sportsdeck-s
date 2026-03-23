import bcrypt from 'bcryptjs'
import { generateToken } from '@/utils/auth'
import { NextResponse } from 'next/server'
import { prisma } from '@/prisma/db'

// Prompt: Implement a user registration endpoint that accepts email, password, and username. Validate the input, hash the password securely, and store the new user in the database. Return a JWT token upon successful registration. Handle errors appropriately, such as duplicate email or username.
// Claude Sonnet 4.6
export async function POST(request) {
  try {
    const { email, password, username } = await request.json()

    if (!email || !password || !username) {
      return NextResponse.json(
        { success: false, error: 'Email, password and username are required' },
        { status: 400 }
      )
    }

    // check if email or username already exists
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    })
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Email or username already taken' },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, username }
    })

    const token = generateToken(user)

    return NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role
        }
      }
    }, { status: 201 })

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}