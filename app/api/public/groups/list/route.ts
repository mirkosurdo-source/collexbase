import { withApiKey, clampLimit } from "@/lib/public-api"
import { connectDB } from "@/lib/db"
import Group from "@/lib/models/Group"

// GET /api/public/groups/list — public, active groups.
export async function GET(req: Request) {
  return withApiKey(req, "read:groups", async () => {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category") || ""
    const limit = clampLimit(searchParams.get("limit"))
    const page = Math.max(1, Number(searchParams.get("page")) || 1)

    const filter: Record<string, unknown> = { privacy: "public", status: "active" }
    if (category) filter.category = category

    const [total, groups] = await Promise.all([
      Group.countDocuments(filter),
      Group.find(filter)
        .sort({ memberCount: -1, lastActivityAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ])

    return {
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      groups: groups.map((g: Record<string, unknown>) => ({
        id: String(g._id),
        name: g.name,
        description: g.description,
        image: g.image,
        category: g.category,
        official: g.official,
        language: g.language,
        memberCount: g.memberCount,
        postCount: g.postCount,
        lastActivityAt: g.lastActivityAt,
      })),
    }
  })
}
