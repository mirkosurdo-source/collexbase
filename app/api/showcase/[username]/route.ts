import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Showcase from "@/lib/models/Showcase"
import { getAuthUserId } from "@/lib/auth/request"
import { getShowcaseByUsername } from "@/lib/showcase"

/** GET /api/showcase/[username] — public showcase for a user. */
export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params
    const viewerId = getAuthUserId(req)
    const showcase = await getShowcaseByUsername(username, viewerId || undefined)
    if (!showcase) {
      return NextResponse.json({ success: false, error: "Vetrina non trovata" }, { status: 404 })
    }

    // Fire-and-forget view counter (don't count owner views).
    if (!showcase.isOwner) {
      connectDB()
        .then(() => Showcase.updateOne({ userId: showcase.userId }, { $inc: { viewCount: 1 } }))
        .catch(() => {})
    }

    return NextResponse.json({ success: true, showcase })
  } catch (error) {
    console.error("[v0] GET /api/showcase/[username] error:", error)
    return NextResponse.json({ success: false, error: "Errore del server" }, { status: 500 })
  }
}
