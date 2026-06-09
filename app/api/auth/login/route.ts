import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail } from '@/lib/db'

// Dummy password check (in production, use proper hashing with bcrypt)
function verifyPassword(inputPassword: string, storedPassword: string): boolean {
  // For testing, just compare directly
  // In production: use bcrypt.compare()
  return inputPassword === storedPassword
}

// Generate a simple JWT-like token (in production, use proper JWT)
function generateToken(userId: string, email: string, role: string): string {
  const payload = {
    userId,
    email,
    role,
    timestamp: Date.now(),
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await getUserByEmail(email)

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    if (!user.active) {
      return NextResponse.json(
        { error: 'Account is disabled' },
        { status: 401 }
      )
    }

    // Verify password
    const passwordValid = verifyPassword(password, user.password)
    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Generate token
    const token = generateToken(user.id, user.email, user.role)

    // Return user and token
    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
