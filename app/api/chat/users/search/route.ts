import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import { getBlockedIds } from "@/lib/chat"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const q = (new URL(req.url).searchParams.get("q") || "").trim()
    if (q.length < 2) {
      return NextResponse.json({ success: true, users: [] })
    }

    await connectDB()
    const blocked = await getBlockedIds(userId)
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

    const users = await User.find({
      _id: { $nin: [userId, ...blocked] },
      blocked: { $ne: true },
      username: { $regex: escaped, $options: "i" },
    })
      .select("username avatar")
      .limit(10)
      .lean<{ _id: unknown; username: string; avatar?: string }[]>()

    return NextResponse.json({
      success: true,
      users: users.map((u) => ({ id: String(u._id), username: u.username, avatar: u.avatar || "" })),
    })
  } catch (error) {
    console.error("[v0] chat/users/search error:", error)
    return NextResponse.json({ success: false, message: "Errore durante la ricerca." }, { status: 500 })
  }
}
