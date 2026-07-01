import { NextResponse } from "next/server"
import { buildAuthUrl, generateState, isGoogleConfigured, OAUTH_STATE_COOKIE } from "@/lib/auth/google"

// GET /api/auth/google — starts the Google OAuth 2.0 login flow.
export async function GET(req: Request) {
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/login?social=unavailable", req.url))
  }

  const origin = new URL(req.url).origin
  const state = generateState()
  const authUrl = buildAuthUrl({ origin, state })

  const res = NextResponse.redirect(authUrl)
  // Single-use, httpOnly anti-CSRF state cookie (10 min, lax for the redirect back).
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  })
  return res
}
