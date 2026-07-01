import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Group from "@/lib/models/Group"
import GroupMember from "@/lib/models/GroupMember"
import { getAuthUserId } from "@/lib/auth/request"

/** POST /api/groups/[groupId]/leave — leave a group (owner cannot leave). */
export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    await connectDB()
    const membership = await GroupMember.findOne({ groupId, userId })
    if (!membership) return NextResponse.json({ success: true, notMember: true })

    if (membership.role === "owner") {
      return NextResponse.json(
        { success: false, message: "Il proprietario non può abbandonare il gruppo." },
        { status: 400 },
      )
    }

    await GroupMember.deleteOne({ _id: membership._id })
    await Group.updateOne({ _id: groupId }, { $inc: { memberCount: -1 } })
    // Remove any admin grant.
    await Group.updateOne({ _id: groupId }, { $pull: { adminIds: userId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] group leave error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
