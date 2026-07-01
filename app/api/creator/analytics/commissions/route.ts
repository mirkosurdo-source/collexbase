import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getCreator } from "@/lib/creator-affiliate"
import { getCommissionHistory } from "@/lib/creator-analytics"

// GET /api/creator/analytics/commissions — detailed commission history.
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ ok: false, error: "Autenticazione richiesta." }, { status: 401 })

  const partner = await getCreator(userId)
  if (!partner) return NextResponse.json({ ok: false, isCreator: false, error: "Non sei un Creator Partner." }, { status: 403 })

  const commissions = await getCommissionHistory(userId, 200)
  return NextResponse.json({ ok: true, commissions })
}
