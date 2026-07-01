import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { notifyShowcaseInvite } from "@/lib/showcase-notifications"

/** POST /api/showcase/[username]/invite — invite a user (by username) to view this showcase. */
export async function POST(req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, error: "Non autorizzato" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const target = String(body.username || "").trim().replace(/^@/, "")
    if (!target) return NextResponse.json({ success: false, error: "Username mancante" }, { status: 400 })

    await connectDB()

    // The inviter must own the showcase at :username.
    const owner = (await User.findById(userId).select("username").lean()) as { username?: string } | null
    if (!owner || owner.username !== username) {
      return NextResponse.json({ success: false, error: "Puoi invitare solo alla tua vetrina." }, { status: 403 })
    }

    const targetUser = (await User.findOne({ username: target }).select("_id").lean()) as { _id: unknown } | null
    if (!targetUser) return NextResponse.json({ success: false, error: "Utente non trovato" }, { status: 404 })

    void notifyShowcaseInvite(String(targetUser._id), username, owner.username || "")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] POST /api/showcase/[username]/invite error:", error)
    return NextResponse.json({ success: false, error: "Errore del server" }, { status: 500 })
  }
}
