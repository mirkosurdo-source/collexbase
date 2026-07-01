import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Follow from "@/lib/models/Follow"
import Listing from "@/lib/models/Listing"
import { getAuthUserId } from "@/lib/auth/request"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    await connectDB()

    const follows = await Follow.find({ followerId: userId }).sort({ createdAt: -1 }).lean()
    const sellerIds = follows.map((f: Record<string, unknown>) => f.sellerId)

    const sellers = follows.map((f: Record<string, unknown>) => ({
      sellerId: String(f.sellerId),
      sellerUsername: f.sellerUsername || "venditore",
    }))

    // Feed: latest active listings from followed sellers.
    const feed = sellerIds.length
      ? await Listing.find({ sellerId: { $in: sellerIds }, status: "active" })
          .sort({ createdAt: -1 })
          .limit(30)
          .lean()
      : []

    return NextResponse.json({
      success: true,
      sellers,
      feed: feed.map((l: Record<string, unknown>) => ({ ...l, _id: String(l._id) })),
    })
  } catch (error) {
    console.error("[v0] market/following error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
