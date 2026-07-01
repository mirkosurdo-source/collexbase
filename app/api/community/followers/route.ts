import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Follow from "@/lib/models/Follow"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"

/**
 * Blocco 25 — list the collectors who follow the current user.
 * Optionally pass ?userId= to view another user's followers.
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
    const follows = await Follow.find({ sellerId: targetId }).sort({ createdAt: -1 }).lean()
    const ids = follows.map((f: Record<string, unknown>) => f.followerId)

    const users = ids.length
      ? await User.find({ _id: { $in: ids } }).select("username avatar name bio").lean()
      : []
    const byId = new Map(users.map((u: Record<string, unknown>) => [String(u._id), u]))

    // Which of these followers does the viewer follow back?
    const mineSet = new Set(
      (await Follow.find({ followerId: authId, sellerId: { $in: ids } }).select("sellerId").lean()).map(
        (f: Record<string, unknown>) => String(f.sellerId),
      ),
    )

    const items = follows.map((f: Record<string, unknown>) => {
      const u = byId.get(String(f.followerId)) as Record<string, unknown> | undefined
      return {
        userId: String(f.followerId),
        username: String(u?.username || "collezionista"),
        avatar: String(u?.avatar || ""),
        name: String(u?.name || ""),
        bio: String(u?.bio || ""),
        youFollow: mineSet.has(String(f.followerId)),
        since: f.createdAt,
      }
    })

    return NextResponse.json({ success: true, total: items.length, followers: items })
  } catch (error) {
    console.error("[v0] community/followers error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
