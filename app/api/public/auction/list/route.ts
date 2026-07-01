import { withApiKey, clampLimit } from "@/lib/public-api"
import { connectDB } from "@/lib/db"
import Auction from "@/lib/models/Auction"

// GET /api/public/auction/list — active auctions.
export async function GET(req: Request) {
  return withApiKey(req, "read:auction", async () => {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") === "closed" ? "closed" : "active"
    const limit = clampLimit(searchParams.get("limit"))
    const page = Math.max(1, Number(searchParams.get("page")) || 1)

    const filter = { status }
    const [total, auctions] = await Promise.all([
      Auction.countDocuments(filter),
      Auction.find(filter)
        .sort({ endsAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ])

    return {
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      auctions: auctions.map((a: Record<string, unknown>) => ({
        id: String(a._id),
        itemName: a.itemName,
        description: a.description,
        image: a.image,
        startingPrice: a.startingPrice,
        currentPrice: a.currentPrice,
        minIncrement: a.minIncrement,
        bidCount: Array.isArray(a.bids) ? a.bids.length : 0,
        status: a.status,
        endsAt: a.endsAt,
        createdAt: a.createdAt,
      })),
    }
  })
}
