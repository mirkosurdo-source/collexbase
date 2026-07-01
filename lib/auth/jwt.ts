import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET || "collexbase-dev-secret-change-me"
const JWT_EXPIRES_IN = "7d"

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    return decoded
  } catch {
    return null
  }
}
