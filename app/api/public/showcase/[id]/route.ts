import { withApiKey, ApiError } from "@/lib/public-api"
import { connectDB } from "@/lib/db"
import Showcase from "@/lib/models/Showcase"
import { isValidObjectId } from "mongoose"

// GET /api/public/showcase/[id] — public showcase detail. Accepts id or username.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return withApiKey(req, "read:showcase", async () => {
    await connectDB()
    const query = isValidObjectId(id) ? { _id: id } : { username: id }
    const s = (await Showcase.findOne({ ...query, visibility: "public" }).lean()) as Record<string, unknown> | null
    if (!s) throw new ApiError(404, "Vetrina non trovata.")
    return {
      id: String(s._id),
      username: s.username,
      title: s.title,
      description: s.description,
      theme: s.theme,
      featuredItems: (Array.isArray(s.featuredItems) ? s.featuredItems : []).map((x) => String(x)),
      followerCount: s.followerCount,
      viewCount: s.viewCount,
      createdAt: s.createdAt,
    }
  })
}
