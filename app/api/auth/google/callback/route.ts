import { NextResponse } from "next/server"
import crypto from "crypto"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import { generateToken } from "@/lib/auth/jwt"
import { exchangeCode, fetchGoogleUser, isGoogleConfigured, OAUTH_STATE_COOKIE } from "@/lib/auth/google"

function fail(req: Request, reason: string) {
  return NextResponse.redirect(new URL(`/login?social=${reason}`, req.url))
}

/** Builds a unique username from the Google email local-part. */
async function uniqueUsername(email: string): Promise<string> {
  const base =
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20) || "user"
  // Try the bare base first, then append short random suffixes until free.
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = attempt === 0 ? base : `${base}_${crypto.randomBytes(3).toString("hex")}`
    const exists = await User.findOne({ username: candidate }).select("_id").lean()
    if (!exists) return candidate
  }
  return `${base}_${crypto.randomBytes(6).toString("hex")}`
}

// GET /api/auth/google/callback — handles Google's OAuth redirect.
export async function GET(req: Request) {
  if (!isGoogleConfigured()) return fail(req, "unavailable")

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")
    const oauthError = url.searchParams.get("error")
    if (oauthError) return fail(req, "denied")
    if (!code || !state) return fail(req, "error")

    // Anti-CSRF / anti-replay: the returned state must match the single-use cookie.
    const cookieState = req.headers
      .get("cookie")
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${OAUTH_STATE_COOKIE}=`))
      ?.split("=")[1]

    if (!cookieState || cookieState !== state) return fail(req, "state")

    const accessToken = await exchangeCode({ code, origin: url.origin })
    const profile = await fetchGoogleUser(accessToken)

    await connectDB()

    let user = await User.findOne({ email: profile.email })

    if (user) {
      if (user.blocked) return fail(req, "blocked")
      // Link the Google identity if not already linked on this account.
      const alreadyLinked = (user.socialAuth || []).some(
        (s: { provider?: string; providerId?: string }) =>
          s.provider === "google" && s.providerId === profile.id,
      )
      if (!alreadyLinked) {
        user.socialAuth = [
          ...(user.socialAuth || []),
          {
            provider: "google",
            providerId: profile.id,
            email: profile.email,
            name: profile.name,
            avatar: profile.avatar,
            linkedAt: new Date(),
          },
        ]
        // Backfill an avatar only if the account doesn't have one yet.
        if (!user.avatar && profile.avatar) user.avatar = profile.avatar
        await user.save()
      }
    } else {
      // Create a new passwordless account with a base profile.
      user = await User.create({
        name: profile.name,
        username: await uniqueUsername(profile.email),
        email: profile.email,
        avatar: profile.avatar,
        socialAuth: [
          {
            provider: "google",
            providerId: profile.id,
            email: profile.email,
            name: profile.name,
            avatar: profile.avatar,
            linkedAt: new Date(),
          },
        ],
      })
    }

    const token = generateToken(String(user._id))

    // Hand the JWT to the client via URL fragment (not sent to servers / not logged).
    const redirect = NextResponse.redirect(new URL(`/auth/social#token=${token}`, req.url))
    // Consume the single-use state cookie.
    redirect.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 })
    return redirect
  } catch (error) {
    console.error("[v0] Errore Google OAuth callback:", error)
    return fail(req, "error")
  }
}
