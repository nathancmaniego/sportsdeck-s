import jwt from 'jsonwebtoken'
import { prisma } from '@/prisma/db'

// Prompt: Implement JWT-based authentication utilities, including token generation, verification, and user authentication for incoming requests. Also include a helper function to check if a user has admin privileges.
// Claude Sonnet 4.6

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return null
  }
}

export async function authenticate(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'No token provided' }
  }

  const token = authHeader.split(' ')[1]
  const decoded = verifyToken(token)
  if (!decoded) {
    return { user: null, error: 'Invalid token' }
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id }
  })

  if (!user) return { user: null, error: 'User not found' }
  if (user.isBanned) return { user: null, error: 'User is banned' }

  return { user, error: null }
}

export async function authenticateIncludingBanned(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'No token provided' }
  }

  const token = authHeader.split(' ')[1]
  const decoded = verifyToken(token)
  if (!decoded) {
    return { user: null, error: 'Invalid token' }
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } })
  if (!user) return { user: null, error: 'User not found' }

  return { user, error: null }
}

export function isAdmin(user) {
  return user.role === 'admin'
}