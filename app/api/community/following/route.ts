import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Follow from "@/lib/models/Follow"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"

/**
 * Blocco 25 — list the collectors the current user follows.
 * Optionally pass ?userId= to view another user's following list.
 */
export async function GET(req: Request) {
  try {
    const authId = getAuthUserId(req)
    if (!authId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const targetId = searchParams.get("userId") || authId

    await connectDB()
    const follows = await Follow.find({ followerId: targetId }).sort({ createdAt: -1 }).lean()
    const ids = follows.map((f: Record<string, unknown>) => f.sellerId)

    const users = ids.length
      ? await User.find({ _id: { $in: ids } }).select("username avatar name bio").lean()
      : []
    const byId = new Map(users.map((u: Record<string, unknown>) => [String(u._id), u]))

    const items = follows.map((f: Record<string, unknown>) => {
      const u = byId.get(String(f.sellerId)) as Record<string, unknown> | undefined
      return {
        userId: String(f.sellerId),
        username: String(u?.username || f.sellerUsername || "collezionista"),
        avatar: String(u?.avatar || ""),
        name: String(u?.name || ""),
        bio: String(u?.bio || ""),
        since: f.createdAt,
      }
    })

    return NextResponse.json({ success: true, total: items.length, following: items })
  } catch (error) {
    console.error("[v0] community/following error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
