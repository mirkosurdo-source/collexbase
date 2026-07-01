import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getCreator, listPayoutRequests, requestPayout } from "@/lib/creator-affiliate"

// GET /api/creator/payout — the caller's payout request history.
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Autenticazione richiesta." }, { status: 401 })
  }
  const partner = await getCreator(userId)
  if (!partner) {
    return NextResponse.json({ ok: false, isCreator: false, error: "Non sei un Creator Partner." }, { status: 403 })
  }
  const requests = await listPayoutRequests({ creatorId: userId, limit: 50 })
  return NextResponse.json({ ok: true, requests })
}

// POST /api/creator/payout — request a cash payout. Body: { amount, destination? }
export async function POST(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Autenticazione richiesta." }, { status: 401 })
  }

  const partner = await getCreator(userId)
  if (!partner) {
    return NextResponse.json({ ok: false, isCreator: false, error: "Non sei un Creator Partner." }, { status: 403 })
  }

  let body: { amount?: number; destination?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Richiesta non valida." }, { status: 400 })
  }

  const result = await requestPayout({
    creatorId: userId,
    amount: Number(body.amount),
    destination: (body.destination || "").trim(),
  })
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 })
  }
  return NextResponse.json(result)
}
