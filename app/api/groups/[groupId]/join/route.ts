import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Group from "@/lib/models/Group"
import GroupMember from "@/lib/models/GroupMember"
import GroupInvite from "@/lib/models/GroupInvite"
import { getAuthUserId } from "@/lib/auth/request"
import { getAuthor } from "@/lib/community"

/** POST /api/groups/[groupId]/join — join a public group or accept an invite. */
export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    await connectDB()
    const group = await Group.findById(groupId)
    if (!group || group.status === "suspended") {
      return NextResponse.json({ success: false, message: "Gruppo non trovato." }, { status: 404 })
    }

    const existing = await GroupMember.findOne({ groupId, userId })
    if (existing) return NextResponse.json({ success: true, alreadyMember: true })

    // Private groups require a pending invite.
    if (group.privacy === "private" && !group.official) {
      const invite = await GroupInvite.findOne({ groupId, invitedUserId: userId, status: "pending" })
      if (!invite) {
        return NextResponse.json({ success: false, message: "Questo gruppo è su invito." }, { status: 403 })
      }
      invite.status = "accepted"
      await invite.save()
    }

    const author = await getAuthor(userId)
    await GroupMember.create({
      groupId,
      userId,
      role: "member",
      username: author?.username || "",
      avatar: author?.avatar || "",
    })
    await Group.updateOne({ _id: groupId }, { $inc: { memberCount: 1 }, $set: { lastActivityAt: new Date() } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] group join error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
