import { withApiKey, ApiError } from "@/lib/public-api"
import { connectDB } from "@/lib/db"
import Listing from "@/lib/models/Listing"
import { isValidObjectId } from "mongoose"

// GET /api/public/market/[id] — single active listing detail.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return withApiKey(req, "read:market", async () => {
    await connectDB()
    if (!isValidObjectId(id)) throw new ApiError(404, "Annuncio non trovato.")
    const l = (await Listing.findOne({ _id: id, status: "active" }).lean()) as Record<string, unknown> | null
    if (!l) throw new ApiError(404, "Annuncio non trovato.")
    return {
      id: String(l._id),
      itemName: l.itemName,
      description: l.description,
      category: l.category,
      condition: l.condition,
      rarity: l.rarity,
      year: l.year,
      price: l.price,
      aiSuggestedPrice: l.aiSuggestedPrice,
      image: l.image,
      photos: l.photos,
      acceptsTrade: l.acceptsTrade,
      acceptsItemPlusCash: l.acceptsItemPlusCash,
      acceptsItemPlusCoins: l.acceptsItemPlusCoins,
      seller: l.sellerUsername,
      savedCount: l.savedCount,
      viewsCount: l.viewsCount,
      createdAt: l.createdAt,
    }
  })
}
