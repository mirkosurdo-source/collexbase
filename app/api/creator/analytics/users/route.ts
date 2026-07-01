import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getCreator } from "@/lib/creator-affiliate"
import { getInvitedUsers } from "@/lib/creator-analytics"

// GET /api/creator/analytics/users — invited users with spend summary.
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ ok: false, error: "Autenticazione richiesta." }, { status: 401 })

  const partner = await getCreator(userId)
  if (!partner) return NextResponse.json({ ok: false, isCreator: false, error: "Non sei un Creator Partner." }, { status: 403 })

  const users = await getInvitedUsers(userId, 100)
  return NextResponse.json({ ok: true, users })
}
