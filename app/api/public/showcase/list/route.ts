import { withApiKey, clampLimit } from "@/lib/public-api"
import { connectDB } from "@/lib/db"
import Showcase from "@/lib/models/Showcase"

// GET /api/public/showcase/list — public showcases.
export async function GET(req: Request) {
  return withApiKey(req, "read:showcase", async () => {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const theme = searchParams.get("theme") || ""
    const limit = clampLimit(searchParams.get("limit"))
    const page = Math.max(1, Number(searchParams.get("page")) || 1)

    const filter: Record<string, unknown> = { visibility: "public" }
    if (theme) filter.theme = theme

    const [total, showcases] = await Promise.all([
      Showcase.countDocuments(filter),
      Showcase.find(filter)
        .sort({ followerCount: -1, viewCount: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ])

    return {
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      showcases: showcases.map((s: Record<string, unknown>) => ({
        id: String(s._id),
        username: s.username,
        title: s.title,
        description: s.description,
        theme: s.theme,
        followerCount: s.followerCount,
        viewCount: s.viewCount,
        createdAt: s.createdAt,
      })),
    }
  })
}
