import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getCreator, listCommissions } from "@/lib/creator-affiliate"

// GET /api/creator/commissions — the caller's commission history (creator only).
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Autenticazione richiesta." }, { status: 401 })
  }

  const partner = await getCreator(userId)
  if (!partner) {
    return NextResponse.json({ ok: false, isCreator: false, error: "Non sei un Creator Partner." }, { status: 403 })
  }

  const url = new URL(req.url)
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50))
  const commissions = await listCommissions(userId, limit)
  return NextResponse.json({ ok: true, commissions })
}
