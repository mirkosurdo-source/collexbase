import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import LiveAuction from "@/lib/models/LiveAuction"
import { getAuthUserId } from "@/lib/auth/request"

// GET /api/live-auction/list — active (and recently ended) live auctions.
export async function GET(req: Request) {
  try {
    const viewerId = getAuthUserId(req)
    await connectDB()

    const docs = await LiveAuction.find({ status: { $in: ["live", "ended"] } })
      .sort({ status: 1, createdAt: -1 })
      .limit(60)
      .lean()

    const now = Date.now()
    const auctions = docs.map((d) => {
      const doc = d as Record<string, unknown>
      const live = doc.status === "live" && new Date(doc.endAt as string).getTime() > now
      return {
        id: String(doc._id),
        itemName: String(doc.itemName || ""),
        image: String(doc.image || ""),
        currentPrice: Number(doc.currentPrice || 0),
        bidCount: Array.isArray(doc.bids) ? (doc.bids as unknown[]).length : 0,
        status: live ? "live" : doc.status === "live" ? "ended" : String(doc.status),
        endAt: new Date(doc.endAt as string).toISOString(),
        sellerUsername: String(doc.sellerUsername || ""),
        isSeller: viewerId ? String(doc.sellerId) === String(viewerId) : false,
      }
    })

    return NextResponse.json({ success: true, auctions })
  } catch (error) {
    console.error("[v0] live-auction list error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
