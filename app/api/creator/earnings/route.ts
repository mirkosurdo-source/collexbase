import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getCreatorEarnings } from "@/lib/creator-affiliate"

// GET /api/creator/earnings — the caller's real-money Creator Earnings summary.
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Autenticazione richiesta." }, { status: 401 })
  }

  const earnings = await getCreatorEarnings(userId)
  if (!earnings) {
    return NextResponse.json({ ok: false, isCreator: false, error: "Non sei un Creator Partner." }, { status: 403 })
  }

  return NextResponse.json({ ok: true, isCreator: true, ...earnings })
}
