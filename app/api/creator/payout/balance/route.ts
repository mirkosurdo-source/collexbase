import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getCreator, getBalance, MIN_PAYOUT_AMOUNT } from "@/lib/creator-affiliate"

// GET /api/creator/payout/balance — available / pending / paid euro balances.
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ ok: false, error: "Autenticazione richiesta." }, { status: 401 })

  const partner = await getCreator(userId)
  if (!partner) return NextResponse.json({ ok: false, isCreator: false, error: "Non sei un Creator Partner." }, { status: 403 })

  const balance = await getBalance(userId)
  return NextResponse.json({ ok: true, balance, minPayout: MIN_PAYOUT_AMOUNT })
}
