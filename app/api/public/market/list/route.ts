import { withApiKey, clampLimit } from "@/lib/public-api"
import { connectDB } from "@/lib/db"
import Listing from "@/lib/models/Listing"

// GET /api/public/market/list — public active marketplace listings.
export async function GET(req: Request) {
  return withApiKey(req, "read:market", async () => {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const query = (searchParams.get("query") || "").trim()
    const category = searchParams.get("category") || ""
    const priceMin = searchParams.get("priceMin")
    const priceMax = searchParams.get("priceMax")
    const sort = searchParams.get("sort") || "recent"
    const limit = clampLimit(searchParams.get("limit"))
    const page = Math.max(1, Number(searchParams.get("page")) || 1)

    const filter: Record<string, unknown> = { status: "active" }
    if (query) {
      filter.$or = [
        { itemName: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { category: { $regex: query, $options: "i" } },
      ]
    }
    if (category) filter.category = category
    if (priceMin || priceMax) {
      const pf: Record<string, number> = {}
      if (priceMin) pf.$gte = Number(priceMin)
      if (priceMax) pf.$lte = Number(priceMax)
      filter.price = pf
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      recent: { createdAt: -1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      popular: { savedCount: -1 },
    }

    const [total, listings] = await Promise.all([
      Listing.countDocuments(filter),
      Listing.find(filter)
        .select("itemName description category condition rarity year price image photos acceptsTrade sellerUsername savedCount viewsCount createdAt")
        .sort(sortMap[sort] || sortMap.recent)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ])

    return {
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      listings: listings.map((l: Record<string, unknown>) => ({
        id: String(l._id),
        itemName: l.itemName,
        description: l.description,
        category: l.category,
        condition: l.condition,
        rarity: l.rarity,
        year: l.year,
        price: l.price,
        image: l.image,
        photos: l.photos,
        acceptsTrade: l.acceptsTrade,
        seller: l.sellerUsername,
        savedCount: l.savedCount,
        viewsCount: l.viewsCount,
        createdAt: l.createdAt,
      })),
    }
  })
}
