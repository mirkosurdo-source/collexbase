import crypto from "crypto"

/**
 * Blocco 49 — Google OAuth 2.0 helper (no external dependency).
 *
 * Implements the Authorization Code flow with anti-CSRF `state`:
 *  - buildAuthUrl(): where the user is sent to consent.
 *  - exchangeCode(): swaps the auth code for tokens.
 *  - fetchGoogleUser(): reads the verified profile.
 *
 * Credentials live only in env (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET),
 * never in code. The redirect URI defaults to `<origin>/api/auth/google/callback`
 * and can be overridden with GOOGLE_REDIRECT_URI.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo"

/** httpOnly cookie name holding the single-use anti-CSRF state token. */
export const OAUTH_STATE_COOKIE = "g_oauth_state"

export interface GoogleProfile {
  id: string
  email: string
  name: string
  avatar: string
  verifiedEmail: boolean
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

/** Computes the redirect URI Google will call back, anchored to the request origin. */
export function getRedirectUri(origin: string): string {
  return process.env.GOOGLE_REDIRECT_URI || `${origin.replace(/\/+$/, "")}/api/auth/google/callback`
}

/** Generates a cryptographically-random state token (anti-CSRF / anti-replay). */
export function generateState(): string {
  return crypto.randomBytes(32).toString("hex")
}

/** Builds the Google consent URL for the Authorization Code flow. */
export function buildAuthUrl(opts: { origin: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: getRedirectUri(opts.origin),
    response_type: "code",
    scope: "openid email profile",
    state: opts.state,
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "select_account",
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

/** Exchanges an authorization code for an access token. */
export async function exchangeCode(opts: { code: string; origin: string }): Promise<string> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: opts.code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: getRedirectUri(opts.origin),
      grant_type: "authorization_code",
    }),
  })

  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status})`)
  }
  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) {
    throw new Error("Google token exchange returned no access_token")
  }
  return data.access_token
}

/** Fetches the authenticated Google user's verified profile. */
export async function fetchGoogleUser(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`Google userinfo failed (${res.status})`)
  }
  const data = (await res.json()) as {
    id?: string
    email?: string
    name?: string
    picture?: string
    verified_email?: boolean
  }
  if (!data.id || !data.email) {
    throw new Error("Google userinfo missing id/email")
  }
  return {
    id: data.id,
    email: data.email.toLowerCase(),
    name: data.name || data.email.split("@")[0],
    avatar: data.picture || "",
    verifiedEmail: Boolean(data.verified_email),
  }
}
