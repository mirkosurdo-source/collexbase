import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getUserTier } from "@/lib/payments"
import { priceAllPackages, COIN_VALUE_EUR } from "@/lib/coins-store"

export const dynamic = "force-dynamic"

/**
 * Returns the store packages with full + tier-discounted prices.
 *
 * Authentication is optional: anonymous visitors see Base pricing, while logged
 * in users get their Gold/Premium discounts computed server-side.
 */
export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    const tier = userId ? await getUserTier(userId) : "Base"
    const packages = priceAllPackages(tier)

    return NextResponse.json({
      success: true,
      coinValueEur: COIN_VALUE_EUR,
      tier,
      packages,
    })
  } catch (error) {
    console.error("[v0] coins packages error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
