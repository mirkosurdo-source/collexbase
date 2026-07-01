import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { setCommissionRate, serializeProfile } from "@/lib/seller"

// POST /api/admin/seller/commission { userId, commissionRate } — admin only.
// commissionRate is a fraction (0.05 = 5%).
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const userId = String(body.userId || "").trim()
  const rate = Number(body.commissionRate)
  if (!userId) return NextResponse.json({ success: false, message: "userId mancante." }, { status: 400 })
  if (!Number.isFinite(rate)) return NextResponse.json({ success: false, message: "Commissione non valida." }, { status: 400 })

  const res = await setCommissionRate(userId, rate)
  if (!res.ok || !res.profile)
    return NextResponse.json({ success: false, message: res.error || "Errore." }, { status: 400 })

  return NextResponse.json({ success: true, profile: serializeProfile(res.profile) })
}
