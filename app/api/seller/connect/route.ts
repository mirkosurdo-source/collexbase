import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import SellerProfile from "@/lib/models/SellerProfile"
import User from "@/lib/models/User"
import { createSellerAccount, createOnboardingLink } from "@/lib/stripe/connect"
import { isStripeConfigured, stripeErrorMessage } from "@/lib/stripe"

/**
 * POST /api/seller/connect
 * Creates (or reuses) the seller's Stripe Connect account and returns a fresh
 * onboarding URL. The userId is taken from the auth token, never the body, to
 * prevent a caller from onboarding on behalf of someone else.
 */
export async function POST(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: "Non autenticato." }, { status: 401 })

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Pagamenti non configurati." }, { status: 503 })
  }

  await connectDB()

  const body = (await req.json().catch(() => ({}))) as { email?: string }
  const user = await User.findById(userId).select("email username").lean<{ email?: string; username?: string }>()
  const email = body.email || user?.email
  if (!email) return NextResponse.json({ error: "Email mancante." }, { status: 400 })

  // Find or create the seller profile (additive — does not touch existing data).
  let profile = await SellerProfile.findOne({ userId })
  if (!profile) {
    profile = await SellerProfile.create({ userId, username: user?.username || "" })
  }

  try {
    if (!profile.stripeAccountId) {
      profile.stripeAccountId = await createSellerAccount(email)
      await profile.save()
    }

    const origin = req.headers.get("origin") || new URL(req.url).origin
    const onboardingUrl = await createOnboardingLink(profile.stripeAccountId, origin)

    return NextResponse.json({ onboardingUrl, stripeAccountId: profile.stripeAccountId })
  } catch (err) {
    return NextResponse.json({ error: stripeErrorMessage(err) }, { status: 500 })
  }
}
