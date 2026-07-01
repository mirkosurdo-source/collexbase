import { withApiKey, ApiError } from "@/lib/public-api"
import { connectDB } from "@/lib/db"
import Group from "@/lib/models/Group"
import { isValidObjectId } from "mongoose"

// GET /api/public/groups/[id] — public group detail.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return withApiKey(req, "read:groups", async () => {
    await connectDB()
    if (!isValidObjectId(id)) throw new ApiError(404, "Gruppo non trovato.")
    const g = (await Group.findOne({ _id: id, privacy: "public", status: "active" }).lean()) as
      | Record<string, unknown>
      | null
    if (!g) throw new ApiError(404, "Gruppo non trovato.")
    return {
      id: String(g._id),
      name: g.name,
      description: g.description,
      image: g.image,
      category: g.category,
      official: g.official,
      language: g.language,
      memberCount: g.memberCount,
      postCount: g.postCount,
      messageCount: g.messageCount,
      lastActivityAt: g.lastActivityAt,
      createdAt: g.createdAt,
    }
  })
}
