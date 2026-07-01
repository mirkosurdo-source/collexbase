import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getActiveSellerProfile, createOnboardingLink } from "@/lib/seller"
import { isStripeConfigured, stripeErrorMessage } from "@/lib/stripe"

// POST /api/seller/stripe/onboard — returns a Stripe Connect onboarding link.
export async function POST(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

  const profile = await getActiveSellerProfile(userId)
  if (!profile)
    return NextResponse.json({ success: false, message: "Profilo venditore non attivo." }, { status: 403 })

  if (!isStripeConfigured())
    return NextResponse.json(
      { success: false, message: "I pagamenti non sono ancora configurati." },
      { status: 503 },
    )

  const origin = req.headers.get("origin") || new URL(req.url).origin
  try {
    const { url } = await createOnboardingLink({ userId, baseUrl: origin })
    return NextResponse.json({ success: true, url })
  } catch (err) {
    return NextResponse.json({ success: false, message: stripeErrorMessage(err) }, { status: 500 })
  }
}
