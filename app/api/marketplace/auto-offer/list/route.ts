import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { listAutoOffers } from "@/lib/marketplace2"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }
    const autoOffers = (await listAutoOffers(userId)).map((a: Record<string, unknown>) => ({
      ...a,
      _id: String(a._id),
      userId: String(a.userId),
      listingId: String(a.listingId),
      sellerId: String(a.sellerId),
    }))
    return NextResponse.json({ success: true, autoOffers })
  } catch (error) {
    console.error("[v0] auto-offer/list error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
