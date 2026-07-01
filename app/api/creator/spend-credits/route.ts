import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { spendCredits } from "@/lib/creator-affiliate"

/** Internal features CreatorCredits can be spent on (never real money). */
const ALLOWED_TARGETS: Record<string, string> = {
  premium: "Premium",
  gold: "Gold",
  boost: "Boost",
  scanner_pro: "Scanner Pro",
  analytics_pro: "Analytics Pro",
  marketplace_pro: "Marketplace Pro",
}

// POST /api/creator/spend-credits — Body: { amount, target }
export async function POST(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Autenticazione richiesta." }, { status: 401 })
  }

  let body: { amount?: number; target?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Richiesta non valida." }, { status: 400 })
  }

  const amount = Number(body.amount)
  const target = (body.target || "").trim()
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "Importo non valido." }, { status: 400 })
  }
  if (!ALLOWED_TARGETS[target]) {
    return NextResponse.json({ ok: false, error: "Destinazione non valida." }, { status: 400 })
  }

  const result = await spendCredits({
    creatorId: userId,
    amount,
    reason: `Utilizzo su ${ALLOWED_TARGETS[target]}`,
  })

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 })
  }
  return NextResponse.json(result)
}
