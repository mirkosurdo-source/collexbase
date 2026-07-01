import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Types } from "mongoose"
import Showcase from "@/lib/models/Showcase"
import ShowcaseFollow from "@/lib/models/ShowcaseFollow"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { notifyShowcaseFollower, notifyShowcaseGrowing } from "@/lib/showcase-notifications"

function oid(id: string) {
  try {
    return new Types.ObjectId(id)
  } catch {
    return id
  }
}

/** POST /api/showcase/[username]/follow — toggle following a user's showcase. */
export async function POST(req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const followerId = getAuthUserId(req)
    if (!followerId) return NextResponse.json({ success: false, error: "Non autorizzato" }, { status: 401 })
    await connectDB()

    const { username } = await params
    const owner = (await User.findOne({ username }).select("_id username").lean()) as
      | { _id: unknown; username: string }
      | null
    if (!owner) return NextResponse.json({ success: false, error: "Utente non trovato" }, { status: 404 })

    const ownerId = String(owner._id)
    if (ownerId === followerId) {
      return NextResponse.json({ success: false, error: "Non puoi seguire la tua vetrina" }, { status: 400 })
    }

    const existing = await ShowcaseFollow.findOne({ followerId: oid(followerId), ownerId: owner._id })
    let following: boolean

    if (existing) {
      await ShowcaseFollow.deleteOne({ _id: existing._id })
      await Showcase.updateOne({ userId: owner._id }, { $inc: { followerCount: -1 } })
      following = false
    } else {
      await ShowcaseFollow.create({ followerId: oid(followerId), ownerId: owner._id, ownerUsername: owner.username })
      await Showcase.updateOne({ userId: owner._id }, { $inc: { followerCount: 1 } })
      following = true

      // Notify the owner (and a growth nudge at milestones).
      const follower = (await User.findById(followerId).select("username").lean()) as { username?: string } | null
      notifyShowcaseFollower(ownerId, owner.username, follower?.username || "").catch(() => {})
      const sc = await Showcase.findOne({ userId: owner._id }).select("followerCount").lean<{ followerCount?: number }>()
      const count = Number(sc?.followerCount || 0)
      if ([10, 50, 100, 500].includes(count)) {
        notifyShowcaseGrowing(ownerId, owner.username, count).catch(() => {})
      }
    }

    const updated = await Showcase.findOne({ userId: owner._id }).select("followerCount").lean<{ followerCount?: number }>()
    return NextResponse.json({ success: true, following, followerCount: Number(updated?.followerCount || 0) })
  } catch (error) {
    console.error("[v0] POST /api/showcase/[username]/follow error:", error)
    return NextResponse.json({ success: false, error: "Errore del server" }, { status: 500 })
  }
}
