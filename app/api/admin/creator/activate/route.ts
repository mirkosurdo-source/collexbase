import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { isValidObjectId } from "mongoose"
import User from "@/lib/models/User"
import { activateCreator } from "@/lib/creator-affiliate"

// POST /api/admin/creator/activate (admin only)
// Body: { creatorId, commissionRate?, commissionDurationMonths? }
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  let body: { creatorId?: string; commissionRate?: number; commissionDurationMonths?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Richiesta non valida." }, { status: 400 })
  }

  const creatorId = (body.creatorId || "").trim()
  if (!isValidObjectId(creatorId)) {
    return NextResponse.json({ ok: false, error: "ID creator non valido." }, { status: 400 })
  }
  const user = await User.findById(creatorId).select("_id")
  if (!user) {
    return NextResponse.json({ ok: false, error: "Utente non trovato." }, { status: 404 })
  }

  const rate =
    typeof body.commissionRate === "number" && body.commissionRate > 0 && body.commissionRate <= 1
      ? body.commissionRate
      : undefined
  const months =
    typeof body.commissionDurationMonths === "number" && body.commissionDurationMonths > 0
      ? Math.round(body.commissionDurationMonths)
      : undefined

  const partner = await activateCreator({ creatorId, commissionRate: rate, commissionDurationMonths: months })
  return NextResponse.json({
    ok: true,
    creatorId,
    referralCode: partner.referralCode,
    commissionRate: partner.commissionRate,
    commissionDurationMonths: partner.commissionDurationMonths,
    active: partner.active,
  })
}
