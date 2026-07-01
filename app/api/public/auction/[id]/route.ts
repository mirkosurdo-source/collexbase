import { withApiKey, ApiError } from "@/lib/public-api"
import { connectDB } from "@/lib/db"
import Auction from "@/lib/models/Auction"
import { isValidObjectId } from "mongoose"

// GET /api/public/auction/[id] — auction detail with bid history.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return withApiKey(req, "read:auction", async () => {
    await connectDB()
    if (!isValidObjectId(id)) throw new ApiError(404, "Asta non trovata.")
    const a = (await Auction.findById(id).lean()) as Record<string, unknown> | null
    if (!a) throw new ApiError(404, "Asta non trovata.")
    const bids = Array.isArray(a.bids) ? (a.bids as Record<string, unknown>[]) : []
    return {
      id: String(a._id),
      itemName: a.itemName,
      description: a.description,
      image: a.image,
      startingPrice: a.startingPrice,
      currentPrice: a.currentPrice,
      minIncrement: a.minIncrement,
      status: a.status,
      endsAt: a.endsAt,
      createdAt: a.createdAt,
      bidCount: bids.length,
      bids: bids.map((b) => ({ username: b.username, amount: b.amount, at: b.createdAt })),
    }
  })
}
