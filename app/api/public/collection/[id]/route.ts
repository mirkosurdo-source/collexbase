import { withApiKey, ApiError } from "@/lib/public-api"
import { connectDB } from "@/lib/db"
import Collection from "@/lib/models/Collection"
import { isValidObjectId } from "mongoose"

// GET /api/public/collection/[id] — single item owned by the key owner.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return withApiKey(req, "read:collection", async (ctx) => {
    await connectDB()
    if (!isValidObjectId(id)) throw new ApiError(404, "Oggetto non trovato.")
    const c = (await Collection.findOne({ _id: id, userId: ctx.userId }).lean()) as Record<string, unknown> | null
    if (!c) throw new ApiError(404, "Oggetto non trovato.")
    return {
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
      updatedAt: c.updatedAt,
    }
  })
}
