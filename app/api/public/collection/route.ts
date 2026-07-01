import { withApiKey, clampLimit } from "@/lib/public-api"
import { connectDB } from "@/lib/db"
import Collection from "@/lib/models/Collection"

// GET /api/public/collection — items in the key owner's collection.
export async function GET(req: Request) {
  return withApiKey(req, "read:collection", async (ctx) => {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category") || ""
    const limit = clampLimit(searchParams.get("limit"))
    const page = Math.max(1, Number(searchParams.get("page")) || 1)

    const filter: Record<string, unknown> = { userId: ctx.userId }
    if (category) filter.category = category

    const [total, items] = await Promise.all([
      Collection.countDocuments(filter),
      Collection.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ])

    const valueRows = await Collection.find({ userId: ctx.userId }).select("value").lean()
    const totalValue = valueRows.reduce(
      (sum: number, r: Record<string, unknown>) => sum + (Number(r.value) || 0),
      0,
    )

    return {
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      totalValue,
      items: items.map((c: Record<string, unknown>) => ({
        id: String(c._id),
        name: c.name,
        description: c.description,
        category: c.category,
        year: c.year,
        value: c.value,
        condition: c.condition,
        rarity: c.rarity ?? null,
        image: c.image,
        createdAt: c.createdAt,
      })),
    }
  })
}
