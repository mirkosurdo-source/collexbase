import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Group from "@/lib/models/Group"
import GroupPost from "@/lib/models/GroupPost"
import { getAuthUserId } from "@/lib/auth/request"
import { getRole, toGroupDTO, canView } from "@/lib/groups"

/** GET /api/groups/[groupId] — group detail (respects privacy). */
export async function GET(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params
    await connectDB()
    const userId = getAuthUserId(req)

    const doc = await Group.findById(groupId).lean()
    if (!doc || (doc as Record<string, unknown>).status === "suspended") {
      return NextResponse.json({ success: false, message: "Gruppo non trovato." }, { status: 404 })
    }

    const role = await getRole(groupId, userId)
    const group = toGroupDTO(doc as Record<string, unknown>, role)

    // Private, non-official groups only expose full content to members.
    const viewable = canView(group)

    // Lightweight counts of trade/auction posts for the header badges.
    const [tradeCount, auctionCount] = viewable
      ? await Promise.all([
          GroupPost.countDocuments({ groupId, postType: "trade" }),
          GroupPost.countDocuments({ groupId, postType: "auction" }),
        ])
      : [0, 0]

    return NextResponse.json({ success: true, group, viewable, counts: { trades: tradeCount, auctions: auctionCount } })
  } catch (error) {
    console.error("[v0] group detail error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
