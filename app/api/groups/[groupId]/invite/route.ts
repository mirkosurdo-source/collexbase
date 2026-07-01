import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Group from "@/lib/models/Group"
import GroupMember from "@/lib/models/GroupMember"
import GroupInvite from "@/lib/models/GroupInvite"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { getAuthor } from "@/lib/community"
import { notifyGroupInvite } from "@/lib/group-notifications"

/** POST /api/groups/[groupId]/invite — invite a user (by username) to the group. */
export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const username = String(body.username || "").trim().replace(/^@/, "")
    if (!username) return NextResponse.json({ success: false, message: "Username mancante." }, { status: 400 })

    await connectDB()

    // Only members can invite.
    const membership = await GroupMember.findOne({ groupId, userId })
    if (!membership) return NextResponse.json({ success: false, message: "Solo i membri possono invitare." }, { status: 403 })

    const group = await Group.findById(groupId).select("name").lean<{ name?: string } | null>()
    if (!group) return NextResponse.json({ success: false, message: "Gruppo non trovato." }, { status: 404 })

    const target = await User.findOne({ username }).select("_id").lean<{ _id: unknown } | null>()
    if (!target) return NextResponse.json({ success: false, message: "Utente non trovato." }, { status: 404 })
    const targetId = String(target._id)

    const already = await GroupMember.findOne({ groupId, userId: targetId })
    if (already) return NextResponse.json({ success: false, message: "L'utente è già membro." }, { status: 409 })

    const author = await getAuthor(userId)
    await GroupInvite.updateOne(
      { groupId, invitedUserId: targetId },
      {
        $set: {
          groupName: group.name || "",
          invitedBy: userId,
          invitedByUsername: author?.username || "",
          status: "pending",
        },
      },
      { upsert: true },
    )

    void notifyGroupInvite(targetId, groupId, group.name || "il gruppo", author?.username || "")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] group invite error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
