import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { claimReferral, type ReferralMethod } from "@/lib/referral"

// POST /api/referral/claim — called by the freshly registered (invited) user.
// Body: { code: string, method?: "link" | "qr" | "whatsapp" }
export async function POST(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Autenticazione richiesta." }, { status: 401 })
  }

  let body: { code?: string; method?: ReferralMethod }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Richiesta non valida." }, { status: 400 })
  }

  const code = (body.code || "").trim()
  if (!code) {
    return NextResponse.json({ ok: false, error: "Codice referral mancante." }, { status: 400 })
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null

  const result = await claimReferral({
    inviterCode: code,
    invitedId: userId,
    method: body.method,
    ip,
  })

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 })
  }
  return NextResponse.json(result)
}
