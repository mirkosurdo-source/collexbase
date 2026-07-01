import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { getAuthUserId } from "@/lib/auth/request"
import { activateBoost, isBoostTargetType, isBoostTier } from "@/lib/boost"
import { notifyBoostActivated } from "@/lib/boost-notifications"
import type { BoostTargetType } from "@/lib/models/BoostActivation"

/**
 * Verifies the authenticated user owns the target they want to boost. Keeps the
 * boost engine decoupled by reading each engine's owner field directly.
 */
async function ownsTarget(userId: string, targetType: BoostTargetType, targetId: string): Promise<boolean> {
  await connectDB()
  try {
    if (targetType === "marketplace") {
      const Listing = (await import("@/lib/models/Listing")).default
      const doc = await Listing.findById(targetId).select("sellerId").lean<{ sellerId: unknown }>()
      return !!doc && String(doc.sellerId) === String(userId)
    }
    if (targetType === "auction") {
      const Auction = (await import("@/lib/models/Auction")).default
      const doc = await Auction.findById(targetId).select("userId").lean<{ userId: unknown }>()
      return !!doc && String(doc.userId) === String(userId)
    }
    if (targetType === "trade") {
      const Trade = (await import("@/lib/models/Trade")).default
      const doc = await Trade.findById(targetId).select("fromUserId").lean<{ fromUserId: unknown }>()
      return !!doc && String(doc.fromUserId) === String(userId)
    }
    if (targetType === "showcase") {
      const Showcase = (await import("@/lib/models/Showcase")).default
      const doc = await Showcase.findOne({ userId: targetId }).select("_id").lean<{ _id: unknown }>()
      // For showcase the targetId is the owner's userId.
      return String(targetId) === String(userId) || !!doc
    }
  } catch {
    return false
  }
  return false
}

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { targetType, targetId, tier } = body || {}

    if (!isBoostTargetType(targetType) || !isBoostTier(tier) || !targetId) {
      return NextResponse.json({ success: false, message: "Parametri non validi." }, { status: 400 })
    }

    // Showcase boosts use the owner's userId as the target id.
    const resolvedTargetId = targetType === "showcase" ? String(userId) : String(targetId)

    const owns = await ownsTarget(userId, targetType, resolvedTargetId)
    if (!owns) {
      return NextResponse.json({ success: false, message: "Non sei il proprietario di questo elemento." }, { status: 403 })
    }

    const result = await activateBoost({ userId, targetType, targetId: resolvedTargetId, tier })
    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.error, balance: result.balance, quote: result.quote },
        { status: 400 },
      )
    }

    // Fire-and-forget CollexSpark notification.
    if (result.boost) {
      notifyBoostActivated(userId, targetType, tier, new Date(result.boost.endsAt)).catch(() => {})
    }

    return NextResponse.json({ success: true, boost: result.boost, balance: result.balance, quote: result.quote })
  } catch (error) {
    console.error("[v0] boost/activate error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
