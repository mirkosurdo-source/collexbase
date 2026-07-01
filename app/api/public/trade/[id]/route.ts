import { withApiKey, ApiError } from "@/lib/public-api"
import { connectDB } from "@/lib/db"
import Trade from "@/lib/models/Trade"
import { isValidObjectId } from "mongoose"

// GET /api/public/trade/[id] — detail of a trade the key owner is part of.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return withApiKey(req, "read:trade", async (ctx) => {
    await connectDB()
    if (!isValidObjectId(id)) throw new ApiError(404, "Scambio non trovato.")
    const t = (await Trade.findById(id).lean()) as Record<string, unknown> | null
    if (!t || (String(t.fromUserId) !== ctx.userId && String(t.toUserId) !== ctx.userId)) {
      throw new ApiError(404, "Scambio non trovato.")
    }
    return {
      id: String(t._id),
      direction: String(t.fromUserId) === ctx.userId ? "outgoing" : "incoming",
      from: t.fromUsername,
      to: t.toUsername,
      offeredItem: { id: t.offeredItemId, name: t.offeredItemName, image: t.offeredItemImage },
      requestedItem: { id: t.requestedItemId, name: t.requestedItemName, image: t.requestedItemImage },
      message: t.message,
      status: t.status,
      createdAt: t.createdAt,
    }
  })
}
