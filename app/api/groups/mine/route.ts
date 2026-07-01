import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getUserGroups, gatherUserGroupStats } from "@/lib/groups"

/** GET /api/groups/mine — the viewer's groups + activity stats. */
export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const [groups, stats] = await Promise.all([getUserGroups(userId), gatherUserGroupStats(userId)])
    return NextResponse.json({ success: true, groups, stats })
  } catch (error) {
    console.error("[v0] groups mine error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
