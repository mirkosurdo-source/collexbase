import { withApiKey, clampLimit } from "@/lib/public-api"
import { connectDB } from "@/lib/db"
import Trade from "@/lib/models/Trade"

// GET /api/public/trade/list — trades the key owner is involved in.
export async function GET(req: Request) {
  return withApiKey(req, "read:trade", async (ctx) => {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") || ""
    const limit = clampLimit(searchParams.get("limit"))
    const page = Math.max(1, Number(searchParams.get("page")) || 1)

    const filter: Record<string, unknown> = {
      $or: [{ fromUserId: ctx.userId }, { toUserId: ctx.userId }],
    }
    if (["pending", "accepted", "rejected"].includes(status)) filter.status = status

    const [total, trades] = await Promise.all([
      Trade.countDocuments(filter),
      Trade.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ])

    return {
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      trades: trades.map((t: Record<string, unknown>) => ({
        id: String(t._id),
        direction: String(t.fromUserId) === ctx.userId ? "outgoing" : "incoming",
        from: t.fromUsername,
        to: t.toUsername,
        offeredItem: { id: t.offeredItemId, name: t.offeredItemName, image: t.offeredItemImage },
        requestedItem: { id: t.requestedItemId, name: t.requestedItemName, image: t.requestedItemImage },
        message: t.message,
        status: t.status,
        createdAt: t.createdAt,
      })),
    }
  })
}
