import { verifyToken } from "@/lib/auth/jwt"

/** Extracts a Bearer token from the Authorization header. */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7)
  }
  return null
}

/** Returns the authenticated user id from the request, or null if unauthenticated. */
export function getAuthUserId(req: Request): string | null {
  const token = extractToken(req)
  if (!token) return null
  const decoded = verifyToken(token)
  return decoded?.userId ?? null
}
