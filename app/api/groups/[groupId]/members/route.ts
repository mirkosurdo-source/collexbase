import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import GroupMember from "@/lib/models/GroupMember"
import { getAuthUserId } from "@/lib/auth/request"
import { getRole } from "@/lib/groups"

/** GET /api/groups/[groupId]/members — list members (admins first). */
export async function GET(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params
    await connectDB()
    const userId = getAuthUserId(req)

    const docs = await GroupMember.find({ groupId })
      .sort({ role: 1, createdAt: 1 })
      .limit(200)
      .lean()

    const ROLE_ORDER: Record<string, number> = { owner: 0, admin: 1, member: 2 }
    const members = docs
      .map((m: Record<string, unknown>) => ({
        userId: String(m.userId),
        username: String(m.username || ""),
        avatar: String(m.avatar || ""),
        role: String(m.role || "member"),
        postCount: Number(m.postCount || 0),
        joinedAt: m.createdAt ? new Date(m.createdAt as string).toISOString() : "",
        isYou: userId ? String(m.userId) === userId : false,
      }))
      .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9))

    const viewerRole = await getRole(groupId, userId)
    return NextResponse.json({ success: true, members, viewerRole })
  } catch (error) {
    console.error("[v0] group members error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
